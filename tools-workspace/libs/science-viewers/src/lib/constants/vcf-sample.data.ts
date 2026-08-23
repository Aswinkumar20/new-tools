export const VCF_SAMPLE = `##fileformat=VCFv4.2
##fileDate=20260808
##source=EasyToolHubSample
##FILTER=<ID=PASS,Description="All filters passed">
##FILTER=<ID=LowQual,Description="Low quality call">
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Read Depth">
##contig=<ID=chr1,length=10000>
##contig=<ID=chr2,length=8000>
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	S1	S2
chr1	100	rsETH1	A	G	99	PASS	DP=80;AF=0.50	GT:DP	0/1:40	0/0:38
chr1	250	.	AT	A	45	LowQual	DP=12;AF=0.10	GT:DP	0/1:8	0/0:6
chr1	400	rsETH2	C	T,G	120	PASS	DP=100;AF=0.30,0.10	GT:DP	1/2:50	0/1:48
chr2	80	rsETH3	G	C	88	PASS	DP=60;AF=0.25	GT:DP	0/1:30	1/1:28
chr2	200	.	A	AT	30	LowQual	DP=8;AF=0.05	GT:DP	0/1:5	0/0:4
chr2	350	rsETH4	GGA	GGA	70	PASS	DP=44;AF=0.20	GT:DP	0/1:22	0/0:20
`;
