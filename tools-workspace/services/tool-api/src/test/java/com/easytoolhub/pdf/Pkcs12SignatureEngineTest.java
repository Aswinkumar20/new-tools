package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.pdf.engine.signature.Pkcs12SignatureEngine;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Date;
import java.util.Map;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.junit.jupiter.api.Test;

class Pkcs12SignatureEngineTest {
  @Test
  void signAndVerifyRoundTrip() throws Exception {
    byte[] pdf = createSamplePdf();
    byte[] p12 = createSelfSignedPkcs12("changeit");
    Pkcs12SignatureEngine engine = new Pkcs12SignatureEngine();

    byte[] signed = engine.sign(pdf, p12, "changeit", "Unit test", "Test lab");
    Map<String, Object> result = engine.verify(signed);

    assertTrue((Boolean) result.get("signed"));
    assertEquals(1, result.get("count"));
    assertEquals(1, result.get("cryptographicallyValidCount"));
  }

  private static byte[] createSamplePdf() throws Exception {
    try (PDDocument doc = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.LETTER);
      doc.addPage(page);
      try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
        cs.newLineAtOffset(72, 720);
        cs.showText("Sign me");
        cs.endText();
      }
      doc.save(bos);
      return bos.toByteArray();
    }
  }

  private static byte[] createSelfSignedPkcs12(String password) throws Exception {
    if (java.security.Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
      java.security.Security.addProvider(new BouncyCastleProvider());
    }
    KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
    kpg.initialize(2048, new SecureRandom());
    KeyPair keyPair = kpg.generateKeyPair();

    X500Name subject = new X500Name("CN=EasyToolHub Test");
    Date notBefore = new Date(System.currentTimeMillis() - 60_000);
    Date notAfter = new Date(System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000);
    JcaX509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(
        subject,
        BigInteger.valueOf(System.currentTimeMillis()),
        notBefore,
        notAfter,
        subject,
        keyPair.getPublic());
    ContentSigner signer = new JcaContentSignerBuilder("SHA256withRSA")
        .setProvider(BouncyCastleProvider.PROVIDER_NAME)
        .build(keyPair.getPrivate());
    X509Certificate cert = new JcaX509CertificateConverter()
        .setProvider(BouncyCastleProvider.PROVIDER_NAME)
        .getCertificate(builder.build(signer));

    KeyStore store = KeyStore.getInstance("PKCS12");
    store.load(null, null);
    store.setKeyEntry("test", keyPair.getPrivate(), password.toCharArray(), new java.security.cert.Certificate[] {cert});
    ByteArrayOutputStream bos = new ByteArrayOutputStream();
    store.store(bos, password.toCharArray());
    return bos.toByteArray();
  }
}
