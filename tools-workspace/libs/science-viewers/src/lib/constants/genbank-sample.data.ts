export const GENBANK_SAMPLE = `LOCUS       ETH001                 120 bp    DNA     linear   UNA 08-AUG-2026
DEFINITION  EasyToolHub sample alcohol-dehydrogenase fragment.
ACCESSION   ETH001
VERSION     ETH001.1
KEYWORDS    demo; education; synthetic.
SOURCE      synthetic construct
  ORGANISM  synthetic construct
            other sequences; artificial sequences.
REFERENCE   1  (bases 1 to 120)
  AUTHORS   EasyToolHub
  TITLE     Sample GenBank record for local preview
  JOURNAL   Unpublished
FEATURES             Location/Qualifiers
     source          1..120
                     /organism="synthetic construct"
                     /mol_type="genomic DNA"
                     /note="education sample"
     promoter        1..9
                     /note="demo promoter"
     gene            10..87
                     /gene="adhS"
                     /locus_tag="ETH_0001"
     CDS             10..87
                     /gene="adhS"
                     /codon_start=1
                     /product="alcohol dehydrogenase fragment"
                     /translation="MTGSYASLRYMTGSY"
     stem_loop       complement(95..110)
                     /note="demo terminator hairpin"
ORIGIN
        1 atgaccggat cgtacgctag cttacggtac atgaccggat cgtacgctag cttacggtac
       61 atgaccggat cgtacgctag cttacggtac atgaccggat cgtacgctag cttacggtac
//
`;
