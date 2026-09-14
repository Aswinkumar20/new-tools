package com.easytoolhub.pdf.engine.signature;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Security;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collection;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.interactive.digitalsignature.PDSignature;
import org.apache.pdfbox.pdmodel.interactive.digitalsignature.SignatureInterface;
import org.apache.pdfbox.pdmodel.interactive.digitalsignature.SignatureOptions;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaCertStore;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cms.CMSProcessableByteArray;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.CMSSignedDataGenerator;
import org.bouncycastle.cms.CMSTypedData;
import org.bouncycastle.cms.SignerInformation;
import org.bouncycastle.cms.SignerInformationStore;
import org.bouncycastle.cms.jcajce.JcaSignerInfoGeneratorBuilder;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;
import org.bouncycastle.util.Store;
import org.springframework.stereotype.Component;

/**
 * PKCS#12 detached CMS signatures via PDFBox + BouncyCastle.
 */
@Component
public class Pkcs12SignatureEngine {

  static {
    if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
      Security.addProvider(new BouncyCastleProvider());
    }
  }

  public byte[] sign(
      byte[] pdfBytes,
      byte[] pkcs12Bytes,
      String pkcs12Password,
      String reason,
      String location
  ) throws Exception {
    if (pdfBytes == null || pdfBytes.length == 0) {
      throw new IllegalArgumentException("PDF file is required");
    }
    if (pkcs12Bytes == null || pkcs12Bytes.length == 0) {
      throw new IllegalArgumentException("PKCS#12 certificate (.p12/.pfx) is required");
    }
    char[] password = (pkcs12Password == null ? "" : pkcs12Password).toCharArray();

    KeyStore keyStore = KeyStore.getInstance("PKCS12");
    try (InputStream in = new ByteArrayInputStream(pkcs12Bytes)) {
      keyStore.load(in, password);
    }

    String alias = findKeyAlias(keyStore, password);
    PrivateKey privateKey = (PrivateKey) keyStore.getKey(alias, password);
    Certificate[] chain = keyStore.getCertificateChain(alias);
    if (privateKey == null || chain == null || chain.length == 0) {
      throw new IllegalArgumentException("PKCS#12 store has no usable private key/certificate chain");
    }
    X509Certificate signerCert = (X509Certificate) chain[0];

    SignatureInterface signer = content -> createDetachedCms(content, privateKey, chain);

    try (PDDocument document = Loader.loadPDF(pdfBytes);
         ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      PDSignature signature = new PDSignature();
      signature.setFilter(PDSignature.FILTER_ADOBE_PPKLITE);
      signature.setSubFilter(PDSignature.SUBFILTER_ADBE_PKCS7_DETACHED);
      signature.setName(extractCn(signerCert));
      if (reason != null && !reason.isBlank()) {
        signature.setReason(reason.trim());
      }
      if (location != null && !location.isBlank()) {
        signature.setLocation(location.trim());
      }
      signature.setSignDate(Calendar.getInstance());

      SignatureOptions options = new SignatureOptions();
      // Larger reserved space for longer cert chains.
      options.setPreferredSignatureSize(SignatureOptions.DEFAULT_SIGNATURE_SIZE * 2);

      document.addSignature(signature, signer, options);
      // Incremental save is required for valid signatures.
      document.saveIncremental(out);
      options.close();
      return out.toByteArray();
    } finally {
      Arrays.fill(password, '\0');
    }
  }

  public Map<String, Object> verify(byte[] pdfBytes) throws Exception {
    try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
      List<Map<String, Object>> signatures = new ArrayList<>();
      int validCount = 0;
      for (PDSignature sig : doc.getSignatureDictionaries()) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", sig.getName());
        item.put("reason", sig.getReason());
        item.put("location", sig.getLocation());
        item.put("signDate", sig.getSignDate() == null ? null : sig.getSignDate().getTime().toString());
        item.put("filter", sig.getFilter());
        item.put("subFilter", sig.getSubFilter());

        try {
          byte[] cmsBytes = sig.getContents();
          byte[] signedContent = sig.getSignedContent(new ByteArrayInputStream(pdfBytes));
          if (cmsBytes == null || cmsBytes.length == 0 || signedContent == null) {
            item.put("integrityValid", false);
            item.put("error", "Missing signature contents");
          } else {
            CMSSignedData signedData = new CMSSignedData(
                new CMSProcessableByteArray(signedContent), cmsBytes);
            SignerInformationStore signers = signedData.getSignerInfos();
            @SuppressWarnings("unchecked")
            Store<X509CertificateHolder> certs = signedData.getCertificates();
            boolean anyValid = false;
            String subject = null;
            for (SignerInformation signerInfo : signers.getSigners()) {
              @SuppressWarnings("unchecked")
              Collection<X509CertificateHolder> matches = certs.getMatches(signerInfo.getSID());
              if (matches == null || matches.isEmpty()) continue;
              X509CertificateHolder holder = matches.iterator().next();
              X509Certificate cert = new JcaX509CertificateConverter()
                  .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                  .getCertificate(holder);
              subject = cert.getSubjectX500Principal().getName();
              boolean ok = signerInfo.verify(
                  new JcaSimpleSignerInfoVerifierBuilder()
                      .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                      .build(cert));
              if (ok) {
                anyValid = true;
                break;
              }
            }
            item.put("integrityValid", anyValid);
            item.put("signerSubject", subject);
            if (anyValid) validCount++;
          }
        } catch (Exception ex) {
          item.put("integrityValid", false);
          item.put("error", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
        }
        signatures.add(item);
      }

      Map<String, Object> result = new LinkedHashMap<>();
      result.put("signed", !signatures.isEmpty());
      result.put("count", signatures.size());
      result.put("cryptographicallyValidCount", validCount);
      result.put("signatures", signatures);
      result.put(
          "note",
          signatures.isEmpty()
              ? "No signature dictionaries found."
              : "Validates CMS integrity against embedded certificates (not full trust-chain / revocation).");
      return result;
    }
  }

  private static byte[] createDetachedCms(
      InputStream content, PrivateKey privateKey, Certificate[] chain) throws IOException {
    try {
      List<Certificate> certList = Arrays.asList(chain);
      JcaCertStore certs = new JcaCertStore(certList);
      CMSSignedDataGenerator gen = new CMSSignedDataGenerator();
      ContentSigner sha256Signer = new JcaContentSignerBuilder(signatureAlgorithm(privateKey))
          .setProvider(BouncyCastleProvider.PROVIDER_NAME)
          .build(privateKey);
      gen.addSignerInfoGenerator(
          new JcaSignerInfoGeneratorBuilder(
                  new JcaDigestCalculatorProviderBuilder()
                      .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                      .build())
              .build(sha256Signer, (X509Certificate) chain[0]));
      gen.addCertificates(certs);

      CMSTypedData msg = new CMSProcessableInputStream(content);
      CMSSignedData signedData = gen.generate(msg, false);
      return signedData.getEncoded();
    } catch (Exception e) {
      throw new IOException("Could not create CMS signature: " + e.getMessage(), e);
    }
  }

  private static String signatureAlgorithm(PrivateKey privateKey) {
    String alg = privateKey.getAlgorithm();
    if (alg != null && alg.toUpperCase().contains("EC")) {
      return "SHA256withECDSA";
    }
    return "SHA256withRSA";
  }

  private static String findKeyAlias(KeyStore keyStore, char[] password) throws Exception {
    Enumeration<String> aliases = keyStore.aliases();
    while (aliases.hasMoreElements()) {
      String alias = aliases.nextElement();
      if (keyStore.isKeyEntry(alias)) {
        return alias;
      }
    }
    throw new IllegalArgumentException("PKCS#12 file contains no private key entry");
  }

  private static String extractCn(X509Certificate cert) {
    String dn = cert.getSubjectX500Principal().getName();
    for (String part : dn.split(",")) {
      String trimmed = part.trim();
      if (trimmed.regionMatches(true, 0, "CN=", 0, 3)) {
        return trimmed.substring(3).trim();
      }
    }
    return dn;
  }

  /** PDFBox-style CMSProcessable that streams the signed byte range. */
  private static final class CMSProcessableInputStream implements CMSTypedData {
    private final InputStream input;

    private CMSProcessableInputStream(InputStream input) {
      this.input = input;
    }

    @Override
    public Object getContent() {
      return input;
    }

    @Override
    public void write(OutputStream out) throws IOException {
      input.transferTo(out);
    }

    @Override
    public org.bouncycastle.asn1.ASN1ObjectIdentifier getContentType() {
      return org.bouncycastle.asn1.cms.CMSObjectIdentifiers.data;
    }
  }
}
