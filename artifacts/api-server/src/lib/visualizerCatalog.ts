// AI Visualizer topic catalog (v83).
//
// A curated, browsable map of medical-school topics (MBBS + BDS) that students can pick from, and
// that admins use to see which topics already have a saved widget. Every catalog topic is a normal
// visualizer prompt: the first student to open it generates the widget, it is saved to the widget
// library under the usual normalised key, and everyone after gets it instantly with no AI call.
//
// Shape: Discipline > Group > Entity, and each entity is expanded through the discipline's aspect
// templates ("{e}: pathogenesis", "{e}: mechanism of action", ...). No database or framework imports,
// so it can be unit-checked on its own (see scripts/check-visualizer-catalog.mjs).
import { promptKey } from "./promptKey";

export interface CatalogGroup { name: string; entities: string[] }
export interface CatalogDiscipline { id: string; name: string; program: "MBBS" | "BDS" | "Both"; aspects: string[]; groups: CatalogGroup[] }
export interface CatalogTopic { id: string; disciplineId: string; discipline: string; program: "MBBS" | "BDS" | "Both"; group: string; entity: string; aspect: string; prompt: string; key: string }

// Entities are written as one "; "-separated string per group to keep this file readable.
const g = (name: string, list: string): CatalogGroup => ({ name, entities: list.split(";").map((s) => s.trim()).filter(Boolean) });

export const CATALOG_DISCIPLINES: CatalogDiscipline[] = [
  {
    id: "anatomy", name: "Anatomy", program: "Both",
    aspects: ["{e}: anatomy and relations", "{e}: blood supply and lymphatic drainage", "{e}: nerve supply and actions", "{e}: clinical anatomy and applied aspects", "{e}: surface marking and radiological anatomy"],
    groups: [
      g("Head and neck", "Scalp; Facial muscles; Facial artery; Parotid gland; Submandibular gland; Temporomandibular joint; Muscles of mastication; Pterygopalatine fossa; Infratemporal fossa; Cavernous sinus; Dural venous sinuses; Circle of Willis; Orbit; Extraocular muscles; Eyeball; Lacrimal apparatus; Nasal cavity; Paranasal sinuses; Oral cavity; Tongue; Palate; Pharynx; Larynx; Thyroid gland; Parathyroid glands; Cervical fascia; Triangles of the neck; Cervical plexus; Subclavian artery; Middle ear; Inner ear; External carotid artery"),
      g("Upper limb", "Pectoral region; Axilla; Brachial plexus; Axillary artery; Shoulder joint; Rotator cuff; Deltoid region; Arm compartments; Cubital fossa; Elbow joint; Forearm flexor compartment; Forearm extensor compartment; Radial nerve; Median nerve; Ulnar nerve; Carpal tunnel; Wrist joint; Palm and palmar spaces; Anatomical snuffbox; Hand intrinsic muscles; Clavicle; Scapula; Humerus; Radius and ulna; Venous drainage of the upper limb"),
      g("Lower limb", "Femoral triangle; Adductor canal; Gluteal region; Hip joint; Femur; Thigh compartments; Sciatic nerve; Popliteal fossa; Knee joint; Menisci and cruciate ligaments; Tibia and fibula; Leg compartments; Common peroneal nerve; Tibial nerve; Ankle joint; Arches of the foot; Sole of the foot; Femoral nerve; Obturator nerve; Venous drainage of the lower limb; Lymphatic drainage of the lower limb; Hip bone; Gait cycle anatomy; Tarsal bones; Dorsum of the foot"),
      g("Thorax", "Thoracic wall; Intercostal space; Diaphragm; Pleura; Lungs; Bronchopulmonary segments; Trachea and bronchi; Mediastinum; Pericardium; Heart chambers; Coronary arteries; Cardiac conduction system; Heart valves; Aorta; Thoracic duct; Oesophagus; Azygos system; Thymus; Superior vena cava; Vagus nerve in the thorax; Sympathetic trunk; Breast; Fetal circulation; Great vessels; Ribs and sternum"),
      g("Abdomen and pelvis", "Anterior abdominal wall; Inguinal canal; Rectus sheath; Peritoneum; Lesser sac; Stomach; Duodenum; Jejunum and ileum; Large intestine; Appendix; Liver; Gallbladder and biliary tree; Pancreas; Spleen; Portal vein; Portocaval anastomoses; Coeliac trunk; Superior mesenteric artery; Inferior mesenteric artery; Kidney; Ureter; Suprarenal gland; Posterior abdominal wall; Lumbar plexus; Urinary bladder; Prostate; Uterus; Ovary and fallopian tube; Rectum and anal canal; Pelvic floor; Perineum; Ischioanal fossa; Pudendal canal; Pelvic fascia; Internal iliac artery"),
      g("Neuroanatomy", "Cerebral cortex; Basal ganglia; Thalamus; Hypothalamus; Limbic system; Internal capsule; Cerebellum; Midbrain; Pons; Medulla oblongata; Fourth ventricle; Lateral ventricles and CSF circulation; Spinal cord; Ascending tracts; Descending tracts; Cranial nerve nuclei; Optic pathway; Auditory pathway; Blood supply of the brain; Meninges; Reticular formation; Autonomic nervous system; Facial nerve; Trigeminal nerve; Cranial nerves III IV and VI"),
    ],
  },
  {
    id: "embryology", name: "Embryology", program: "Both",
    aspects: ["{e}: stages of development", "{e}: derivatives and fate", "{e}: congenital anomalies", "{e}: molecular signals and genes", "{e}: clinical correlation"],
    groups: [
      g("General embryology", "Gametogenesis; Fertilisation; Cleavage and blastocyst; Implantation; Bilaminar disc; Gastrulation; Neurulation; Neural crest; Somites; Intraembryonic coelom; Placenta; Umbilical cord; Fetal membranes; Twinning"),
      g("Systemic embryology", "Heart tube; Septation of the heart; Aortic arches; Pharyngeal arches; Pharyngeal pouches; Foregut; Midgut rotation; Hindgut and cloaca; Liver and pancreas; Diaphragm; Kidney and ureter; Urogenital sinus; Gonads; Genital ducts; External genitalia; Limb buds; Palate and face; Eye; Ear; Spinal cord and brain vesicles"),
    ],
  },
  {
    id: "histology", name: "Histology", program: "Both",
    aspects: ["{e}: microscopic structure", "{e}: cell types and their functions", "{e}: special stains and identification", "{e}: structure-function relationship", "{e}: histopathological changes"],
    groups: [
      g("Basic tissues", "Simple epithelium; Stratified epithelium; Glandular epithelium; Connective tissue proper; Cartilage; Bone; Skeletal muscle; Cardiac muscle; Smooth muscle; Nervous tissue; Blood and bone marrow"),
      g("Organ histology", "Skin; Lymph node; Spleen; Thymus; Trachea and lung; Oesophagus; Stomach; Small intestine; Large intestine; Liver; Pancreas; Kidney; Ureter and bladder; Testis; Ovary; Thyroid; Adrenal gland; Pituitary gland"),
    ],
  },
  {
    id: "physiology", name: "Physiology", program: "Both",
    aspects: ["{e}: mechanism step by step", "{e}: regulation and feedback control", "{e}: graphs and normal values", "{e}: changes in disease", "{e}: applied and exercise physiology"],
    groups: [
      g("General physiology", "Membrane potential; Action potential; Sodium-potassium pump; Osmosis and tonicity; Transport across membranes; Body fluid compartments; Homeostasis; Neuromuscular junction; Excitation-contraction coupling; Synaptic transmission; Receptor potentials; Cell signalling pathways"),
      g("Blood and immunity", "Erythropoiesis; Haemoglobin and oxygen carriage; Haemostasis; Coagulation cascade; Fibrinolysis; Blood groups; White cell function; Platelet function; Iron metabolism; Plasma proteins"),
      g("Cardiovascular", "Cardiac cycle; Cardiac output; Frank-Starling mechanism; Pacemaker potential; ECG waveform; Heart sounds; Blood pressure regulation; Baroreceptor reflex; Venous return; Coronary circulation; Microcirculation; Capillary exchange; Cerebral circulation; Pressure-volume loop; Hypertension physiology; Shock physiology; Exercise and the circulation"),
      g("Respiratory", "Mechanics of breathing; Lung compliance; Surfactant; Lung volumes and capacities; Ventilation-perfusion matching; Gas exchange; Oxygen-haemoglobin dissociation curve; Carbon dioxide transport; Control of respiration; Chemoreceptors; High altitude adaptation; Diving physiology; Pulmonary circulation; Dead space"),
      g("Renal and acid-base", "Glomerular filtration; Tubular reabsorption; Countercurrent mechanism; Renin-angiotensin-aldosterone system; Antidiuretic hormone action; Micturition reflex; Acid-base balance; Potassium handling; Sodium balance; Renal clearance; Autoregulation of renal blood flow; Calcium and phosphate handling"),
      g("Gastrointestinal", "Gastric secretion; Pancreatic secretion; Bile secretion and enterohepatic circulation; Intestinal motility; Swallowing; Vomiting reflex; Digestion and absorption; Gastrointestinal hormones; Defaecation reflex; Liver functions"),
      g("Endocrine and reproduction", "Hypothalamic-pituitary axis; Growth hormone; Thyroid hormone synthesis; Cortisol and the stress response; Insulin and glucagon; Calcium homeostasis; Adrenal medulla; Menstrual cycle; Spermatogenesis; Pregnancy hormones; Lactation; Puberty; Menopause; Parathyroid hormone"),
      g("Neurophysiology", "Somatosensory pathways; Pain pathways; Motor cortex and pyramidal tract; Stretch reflex; Muscle spindle and Golgi tendon organ; Cerebellar function; Basal ganglia circuits; Vestibular system; Vision and the visual pathway; Hearing and cochlear mechanics; Taste and smell; Sleep and EEG; Memory and learning; Speech and language; Autonomic reflexes; Temperature regulation; Hypothalamic functions; Cerebrospinal fluid dynamics"),
      g("Special topics", "Muscle contraction; Skeletal muscle energetics; Smooth muscle physiology; Fetal and neonatal physiology; Ageing physiology; Nutrition and energy balance; Exercise physiology; Hunger and thirst regulation; Physiology of stress; Pain modulation"),
    ],
  },
  {
    id: "biochemistry", name: "Biochemistry", program: "Both",
    aspects: ["{e}: reactions and enzymes", "{e}: regulation and energetics", "{e}: tissue-specific features", "{e}: inherited and acquired disorders", "{e}: laboratory tests and clinical correlation"],
    groups: [
      g("Metabolic pathways", "Glycolysis; Citric acid cycle; Oxidative phosphorylation; Pentose phosphate pathway; Gluconeogenesis; Glycogen metabolism; Fructose and galactose metabolism; Beta-oxidation of fatty acids; Ketone body metabolism; Fatty acid synthesis; Cholesterol synthesis; Lipoprotein metabolism; Urea cycle; Amino acid catabolism; Purine metabolism; Pyrimidine metabolism; Haem synthesis and breakdown; Heme degradation and bilirubin; Fed-fasting cycle"),
      g("Molecular biology", "DNA replication; DNA repair; Transcription; Translation; Genetic code; Gene regulation in prokaryotes; Gene regulation in eukaryotes; Recombinant DNA technology; Polymerase chain reaction; Blotting techniques; Mutations; Protein folding and degradation; Post-translational modification; Telomeres and telomerase"),
      g("Biomolecules and nutrition", "Enzyme kinetics; Enzyme inhibition; Protein structure; Collagen structure; Haemoglobin structure; Carbohydrate chemistry; Lipid chemistry; Membrane structure; Fat-soluble vitamins; Water-soluble vitamins; Mineral metabolism; Protein energy malnutrition; Dietary fibre; Free radicals and antioxidants; Acid-base buffers; Plasma proteins"),
      g("Clinical biochemistry", "Diabetes biomarkers; Lipid profile; Liver function tests; Renal function tests; Cardiac biomarkers; Inborn errors of metabolism; Lysosomal storage diseases; Glycogen storage diseases; Porphyrias; Hormone assays; Tumour markers; Electrolyte disorders"),
    ],
  },
  {
    id: "pathology", name: "Pathology", program: "Both",
    aspects: ["{e}: pathogenesis", "{e}: gross and microscopic morphology", "{e}: clinical features and course", "{e}: complications", "{e}: diagnosis and laboratory findings"],
    groups: [
      g("General pathology", "Reversible cell injury; Necrosis types; Apoptosis; Acute inflammation; Chronic inflammation; Granulomatous inflammation; Wound healing; Amyloidosis; Thrombosis; Embolism; Infarction; Oedema; Shock; Neoplasia and oncogenes; Tumour suppressor genes; Metastasis cascade; Carcinogenesis; Hypersensitivity reactions; Transplant rejection; Autoimmunity; Immunodeficiency; Calcification"),
      g("Haematology", "Iron deficiency anaemia; Megaloblastic anaemia; Aplastic anaemia; Haemolytic anaemias; Sickle cell disease; Thalassaemia; Acute myeloid leukaemia; Acute lymphoblastic leukaemia; Chronic myeloid leukaemia; Chronic lymphocytic leukaemia; Hodgkin lymphoma; Non-Hodgkin lymphoma; Multiple myeloma; Haemophilia; Von Willebrand disease; Immune thrombocytopenic purpura; Disseminated intravascular coagulation; Myelodysplastic syndromes; Polycythaemia vera"),
      g("Systemic pathology", "Atherosclerosis; Myocardial infarction; Rheumatic heart disease; Infective endocarditis; Cardiomyopathies; Vasculitis; Emphysema; Chronic bronchitis; Bronchial asthma; Pneumonia; Lung tuberculosis; Lung carcinoma; Peptic ulcer; Gastric carcinoma; Inflammatory bowel disease; Colorectal carcinoma; Viral hepatitis; Cirrhosis of the liver; Hepatocellular carcinoma; Acute pancreatitis; Glomerulonephritis; Nephrotic syndrome; Renal cell carcinoma; Prostate carcinoma; Breast carcinoma; Cervical carcinoma; Ovarian tumours; Thyroid neoplasms; Diabetes mellitus pathology; Osteomyelitis; Osteosarcoma; Multiple sclerosis; Alzheimer disease; Brain tumours; Melanoma"),
    ],
  },
  {
    id: "pharmacology", name: "Pharmacology", program: "Both",
    aspects: ["{e}: mechanism of action", "{e}: pharmacokinetics", "{e}: adverse effects and interactions", "{e}: clinical uses and contraindications", "{e}: comparison with related drugs"],
    groups: [
      g("General pharmacology", "Receptor theory; Dose-response curves; Drug absorption; Drug distribution; Drug metabolism and cytochrome P450; Drug excretion; Half-life and steady state; Drug interactions; Adverse drug reactions; Pharmacogenomics; Drug development and clinical trials"),
      g("Autonomic and CNS drugs", "Cholinergic agonists; Anticholinesterases; Muscarinic antagonists; Adrenergic agonists; Beta blockers; Alpha blockers; Neuromuscular blockers; General anaesthetics; Local anaesthetics; Benzodiazepines; Barbiturates; Antiepileptic drugs; Antiparkinsonian drugs; Opioid analgesics; Antipsychotics; Antidepressants; Lithium; Skeletal muscle relaxants; Anxiolytics and hypnotics; Drugs for Alzheimer disease"),
      g("Cardiovascular and renal drugs", "ACE inhibitors; Angiotensin receptor blockers; Calcium channel blockers; Nitrates; Digoxin; Antiarrhythmic drugs; Loop diuretics; Thiazide diuretics; Potassium-sparing diuretics; Statins; Antiplatelet drugs; Heparin; Warfarin; Direct oral anticoagulants; Thrombolytics; Antihypertensive drugs; Drugs for heart failure; Drugs for angina; Lipid-lowering drugs; Vasopressors and inotropes"),
      g("Endocrine and metabolic drugs", "Insulin preparations; Metformin; Sulfonylureas; SGLT2 inhibitors; GLP-1 agonists; Thyroid drugs; Corticosteroids; Oral contraceptives; Sex hormones; Bisphosphonates; Drugs for osteoporosis; Oxytocin and uterotonics"),
      g("Chemotherapy and antimicrobials", "Penicillins; Cephalosporins; Carbapenems; Aminoglycosides; Macrolides; Fluoroquinolones; Tetracyclines; Sulfonamides and trimethoprim; Vancomycin; Antitubercular drugs; Antifungal drugs; Antiviral drugs; Antiretroviral drugs; Antimalarial drugs; Anthelmintic drugs; Alkylating agents; Antimetabolites; Cytotoxic antibiotics; Monoclonal antibodies; Tyrosine kinase inhibitors; Immunosuppressants"),
      g("Respiratory, GI and others", "Drugs for bronchial asthma; Antitussives; Proton pump inhibitors; H2 receptor blockers; Antiemetics; Laxatives; Antidiarrhoeal drugs; NSAIDs; Paracetamol; Drugs for gout; Antihistamines; Drugs for rheumatoid arthritis; Drugs for migraine; Antidotes and poisoning management; Vitamin and mineral supplements; Drugs in pregnancy; Drugs in the elderly; Haematinics"),
    ],
  },
  {
    id: "microbiology", name: "Microbiology", program: "Both",
    aspects: ["{e}: structure and virulence factors", "{e}: transmission and life cycle", "{e}: pathogenesis and clinical features", "{e}: laboratory diagnosis", "{e}: treatment, prevention and control"],
    groups: [
      g("Bacteria", "Staphylococcus aureus; Streptococcus pyogenes; Streptococcus pneumoniae; Enterococcus; Neisseria meningitidis; Neisseria gonorrhoeae; Corynebacterium diphtheriae; Clostridium tetani; Clostridium botulinum; Clostridium difficile; Bacillus anthracis; Escherichia coli; Salmonella typhi; Shigella; Vibrio cholerae; Klebsiella; Pseudomonas aeruginosa; Helicobacter pylori; Mycobacterium tuberculosis; Mycobacterium leprae; Treponema pallidum; Leptospira; Borrelia; Chlamydia trachomatis; Rickettsia; Mycoplasma pneumoniae; Haemophilus influenzae; Bordetella pertussis; Legionella; Brucella; Yersinia pestis; Campylobacter; Listeria"),
      g("Viruses", "Hepatitis B virus; Hepatitis C virus; Hepatitis A virus; Human immunodeficiency virus; Herpes simplex virus; Varicella zoster virus; Cytomegalovirus; Epstein-Barr virus; Influenza virus; SARS-CoV-2; Dengue virus; Rabies virus; Poliovirus; Rotavirus; Measles virus; Mumps virus; Human papillomavirus; Japanese encephalitis virus; Ebola virus; Rubella virus"),
      g("Parasites", "Plasmodium falciparum; Plasmodium vivax; Entamoeba histolytica; Giardia lamblia; Leishmania donovani; Trypanosoma; Toxoplasma gondii; Ascaris lumbricoides; Hookworm; Wuchereria bancrofti; Taenia solium; Echinococcus granulosus; Schistosoma"),
      g("Fungi and general", "Candida albicans; Aspergillus; Cryptococcus neoformans; Dermatophytes; Sterilisation and disinfection; Bacterial growth curve; Bacterial genetics; Antimicrobial resistance; Culture media; Gram staining; Hospital-acquired infections; Normal flora; Biomedical waste management; Innate immunity; Antigen-antibody reactions; Vaccines"),
    ],
  },
  {
    id: "immunology", name: "Immunology and Genetics", program: "Both",
    aspects: ["{e}: mechanism and key players", "{e}: regulation and checkpoints", "{e}: clinical disorders", "{e}: laboratory assessment", "{e}: therapeutic targets"],
    groups: [
      g("Immunology", "Antigen presentation; MHC and HLA; B cell activation; T cell development; T helper cell subsets; Complement system; Cytokine signalling; Immunoglobulin classes; Class switching; Tolerance and autoimmunity; Hypersensitivity type I; Hypersensitivity type IV; Immunological memory; Natural killer cells; Transplant immunology; Tumour immunity; Immunodeficiency disorders; Vaccine immunology"),
      g("Genetics", "Mendelian inheritance; Pedigree analysis; Mitochondrial inheritance; Chromosomal abnormalities; Down syndrome; Turner syndrome; Klinefelter syndrome; Fragile X syndrome; Trinucleotide repeat disorders; Genomic imprinting; Population genetics; Cancer genetics; Prenatal diagnosis; Pharmacogenetics; Gene therapy"),
    ],
  },
  {
    id: "medicine", name: "Medicine", program: "MBBS",
    aspects: ["{e}: pathophysiology in clinical practice", "{e}: history and examination findings", "{e}: investigations and diagnostic algorithm", "{e}: management algorithm", "{e}: complications and prognosis"],
    groups: [
      g("Cardiology", "Acute coronary syndrome; Stable angina; Heart failure with reduced ejection fraction; Atrial fibrillation; Ventricular tachycardia; Aortic stenosis; Mitral stenosis; Mitral regurgitation; Hypertensive emergency; Infective endocarditis diagnosis; Pericardial effusion and tamponade; Cor pulmonale; Congenital heart disease in adults; Cardiogenic shock; Pulmonary embolism; Aortic dissection; Complete heart block; Hypertrophic cardiomyopathy"),
      g("Respiratory medicine", "Asthma exacerbation; COPD exacerbation; Community-acquired pneumonia; Pulmonary tuberculosis; Pleural effusion; Pneumothorax; Interstitial lung disease; Bronchiectasis; Respiratory failure; Obstructive sleep apnoea; Sarcoidosis; Acute respiratory distress syndrome"),
      g("Gastroenterology and hepatology", "Upper gastrointestinal bleeding; Peptic ulcer disease; Gastro-oesophageal reflux disease; Ulcerative colitis; Crohn disease; Coeliac disease; Chronic liver disease; Hepatic encephalopathy; Ascites; Variceal bleeding; Acute liver failure; Wilson disease; Irritable bowel syndrome; Chronic pancreatitis"),
      g("Nephrology", "Acute kidney injury; Chronic kidney disease; Nephrotic syndrome in adults; Nephritic syndrome; Diabetic nephropathy; Polycystic kidney disease; Renal tubular acidosis; Hyperkalaemia; Hyponatraemia; Dialysis; Urinary tract infection; Renal artery stenosis"),
      g("Endocrinology", "Type 1 diabetes; Type 2 diabetes; Diabetic ketoacidosis; Hyperosmolar hyperglycaemic state; Hypoglycaemia; Hyperthyroidism; Hypothyroidism; Cushing syndrome; Addison disease; Phaeochromocytoma; Acromegaly; Hyperparathyroidism; Diabetes insipidus; Metabolic syndrome; Hyperprolactinaemia; Primary hyperaldosteronism"),
      g("Neurology", "Ischaemic stroke; Intracerebral haemorrhage; Subarachnoid haemorrhage; Epilepsy; Status epilepticus; Parkinson disease; Multiple sclerosis in practice; Myasthenia gravis; Guillain-Barre syndrome; Meningitis; Encephalitis; Migraine; Motor neurone disease; Raised intracranial pressure; Peripheral neuropathy; Spinal cord compression; Dementia"),
      g("Haematology and oncology", "Anaemia work-up; Deep vein thrombosis; Sickle cell crisis; Lymphoma staging; Acute leukaemia management; Febrile neutropenia; Tumour lysis syndrome; Superior vena cava syndrome; Hypercalcaemia of malignancy; Blood transfusion reactions; Bleeding disorders; Myeloproliferative neoplasms"),
      g("Rheumatology and infectious disease", "Rheumatoid arthritis; Systemic lupus erythematosus; Gout; Ankylosing spondylitis; Systemic sclerosis; Vasculitis syndromes; Osteoarthritis; Typhoid fever; Malaria; Dengue fever; HIV infection; Sepsis; Leptospirosis; Tuberculous meningitis; Pyrexia of unknown origin; Tetanus; Rabies exposure; Hepatitis B infection; Cholera; Infective diarrhoea"),
    ],
  },
  {
    id: "surgery", name: "Surgery", program: "MBBS",
    aspects: ["{e}: surgical anatomy and pathology", "{e}: clinical presentation and examination", "{e}: investigations and imaging", "{e}: surgical and non-operative management", "{e}: postoperative care and complications"],
    groups: [
      g("General and abdominal surgery", "Acute appendicitis; Intestinal obstruction; Acute cholecystitis; Choledocholithiasis; Hernia types; Peritonitis; Perforated peptic ulcer; Acute pancreatitis surgery; Carcinoma of the stomach; Colorectal cancer surgery; Haemorrhoids; Anal fistula; Anal fissure; Rectal prolapse; Diverticular disease; Splenic injury; Liver abscess; Hydatid cyst of the liver"),
      g("Endocrine, breast and vascular surgery", "Thyroid nodule; Thyroid cancer; Goitre; Parathyroid surgery; Carcinoma of the breast; Fibroadenoma; Peripheral arterial disease; Varicose veins; Deep vein thrombosis surgery; Abdominal aortic aneurysm; Diabetic foot; Acute limb ischaemia; Lymphoedema; Raynaud phenomenon"),
      g("Urology and trauma", "Renal calculi; Benign prostatic hyperplasia; Carcinoma of the prostate; Bladder cancer; Testicular torsion; Hydrocele; Urethral stricture; Haematuria; Chest trauma; Head injury; Abdominal trauma; Pelvic fracture; Burns management; Shock in surgical patients; Advanced trauma life support; Fluid and electrolyte balance in surgery; Wound healing and sutures; Surgical site infection; Skin grafts; Pre-operative assessment; Cleft lip and palate; Salivary gland tumours; Oral cancer; Oesophageal carcinoma; Achalasia cardia"),
    ],
  },
  {
    id: "obgyn", name: "Obstetrics and Gynaecology", program: "MBBS",
    aspects: ["{e}: physiology and pathophysiology", "{e}: clinical features and examination", "{e}: investigations", "{e}: management", "{e}: complications and maternal-fetal outcome"],
    groups: [
      g("Obstetrics", "Normal labour mechanism; Stages of labour; Partograph; Antenatal care; Pre-eclampsia; Eclampsia; Gestational diabetes; Antepartum haemorrhage; Placenta praevia; Placental abruption; Postpartum haemorrhage; Preterm labour; Premature rupture of membranes; Ectopic pregnancy; Abortion; Hyperemesis gravidarum; Rh isoimmunisation; Multiple pregnancy; Breech presentation; Obstructed labour; Cord prolapse; Shoulder dystocia; Puerperal sepsis; Caesarean section; Fetal growth restriction; Anaemia in pregnancy; Cardiac disease in pregnancy; Induction of labour"),
      g("Gynaecology", "Menstrual disorders; Polycystic ovary syndrome; Endometriosis; Uterine fibroids; Pelvic inflammatory disease; Cervical cancer screening; Carcinoma of the endometrium; Ovarian cysts; Infertility; Contraception methods; Menopause and hormone therapy; Pelvic organ prolapse; Amenorrhoea; Gestational trophoblastic disease; Vaginal discharge"),
    ],
  },
  {
    id: "pediatrics", name: "Paediatrics", program: "MBBS",
    aspects: ["{e}: age-specific presentation", "{e}: pathophysiology", "{e}: investigations and diagnosis", "{e}: management and prevention", "{e}: complications and long-term outcome"],
    groups: [
      g("Neonatology and growth", "Neonatal jaundice; Respiratory distress syndrome of the newborn; Neonatal sepsis; Birth asphyxia; Low birth weight infants; Neonatal hypoglycaemia; Growth monitoring; Developmental milestones; Immunisation schedule; Breastfeeding; Protein-energy malnutrition in children; Rickets; Vitamin A deficiency; Failure to thrive"),
      g("Childhood illnesses", "Acute diarrhoea in children; Pneumonia in children; Bronchiolitis; Croup; Febrile seizures; Kawasaki disease; Rheumatic fever; Nephrotic syndrome in children; Acute glomerulonephritis in children; Congenital heart disease in children; Cystic fibrosis; Down syndrome care; Childhood tuberculosis; Measles; Meningitis in children; Cerebral palsy; Type 1 diabetes in children; Thalassaemia major care; Iron deficiency anaemia in children; Leukaemia in children"),
    ],
  },
  {
    id: "ent", name: "ENT", program: "MBBS",
    aspects: ["{e}: anatomy and pathology", "{e}: clinical features", "{e}: investigations", "{e}: management", "{e}: complications"],
    groups: [
      g("Ear, nose and throat", "Otitis media; Cholesteatoma; Otosclerosis; Sensorineural hearing loss; Meniere disease; Facial nerve palsy; Vertigo; Epistaxis; Nasal polyps; Chronic sinusitis; Deviated nasal septum; Allergic rhinitis; Tonsillitis; Adenoid hypertrophy; Peritonsillar abscess; Laryngeal carcinoma; Vocal cord paralysis; Foreign body airway; Tracheostomy; Nasopharyngeal carcinoma; Hoarseness; Deep neck space infections"),
    ],
  },
  {
    id: "ophthalmology", name: "Ophthalmology", program: "MBBS",
    aspects: ["{e}: anatomy and pathology", "{e}: clinical features", "{e}: investigations", "{e}: management", "{e}: complications"],
    groups: [
      g("Eye diseases", "Cataract; Glaucoma; Diabetic retinopathy; Retinal detachment; Age-related macular degeneration; Conjunctivitis; Corneal ulcer; Uveitis; Refractive errors; Squint; Optic neuritis; Papilloedema; Retinitis pigmentosa; Ptosis; Dacryocystitis; Trachoma; Keratoconus; Central retinal artery occlusion; Orbital cellulitis; Ocular trauma"),
    ],
  },
  {
    id: "psychiatry", name: "Psychiatry", program: "MBBS",
    aspects: ["{e}: neurobiology and aetiology", "{e}: clinical features and diagnosis", "{e}: assessment and rating scales", "{e}: treatment approaches", "{e}: course and outcome"],
    groups: [
      g("Psychiatric disorders", "Schizophrenia; Bipolar disorder; Major depressive disorder; Generalised anxiety disorder; Panic disorder; Obsessive-compulsive disorder; Post-traumatic stress disorder; Alcohol dependence; Opioid dependence; Delirium; Dementia in psychiatry; Anorexia nervosa; Bulimia nervosa; Personality disorders; Somatoform disorders; Attention deficit hyperactivity disorder; Autism spectrum disorder; Suicide risk assessment"),
    ],
  },
  {
    id: "dermatology", name: "Dermatology", program: "MBBS",
    aspects: ["{e}: pathogenesis", "{e}: clinical morphology", "{e}: diagnosis", "{e}: treatment", "{e}: complications and associations"],
    groups: [
      g("Skin diseases", "Psoriasis; Atopic dermatitis; Acne vulgaris; Leprosy; Scabies; Tinea infections; Pemphigus vulgaris; Bullous pemphigoid; Urticaria; Vitiligo; Herpes zoster; Impetigo; Lichen planus; Stevens-Johnson syndrome; Basal cell carcinoma; Squamous cell carcinoma of the skin; Cutaneous leishmaniasis; Alopecia areata"),
    ],
  },
  {
    id: "orthopedics", name: "Orthopaedics", program: "MBBS",
    aspects: ["{e}: anatomy and mechanism of injury", "{e}: clinical features", "{e}: imaging", "{e}: management", "{e}: complications"],
    groups: [
      g("Fractures and joints", "Colles fracture; Supracondylar fracture of the humerus; Fracture neck of femur; Fracture shaft of femur; Tibial shaft fracture; Scaphoid fracture; Clavicle fracture; Dislocation of the shoulder; Dislocation of the hip; Compartment syndrome; Fracture healing; Osteoporosis; Osteoarthritis of the knee; Rheumatoid arthritis of the hand; Osteomyelitis in orthopaedics; Septic arthritis; Bone tumours; Developmental dysplasia of the hip; Perthes disease; Slipped capital femoral epiphysis; Club foot; Scoliosis; Prolapsed intervertebral disc; Carpal tunnel syndrome; Peripheral nerve injury; Spinal cord injury"),
    ],
  },
  {
    id: "anaesthesia", name: "Anaesthesia, Radiology and Emergency", program: "MBBS",
    aspects: ["{e}: principles", "{e}: technique", "{e}: indications and contraindications", "{e}: complications", "{e}: monitoring and safety"],
    groups: [
      g("Anaesthesia and critical care", "General anaesthesia induction; Spinal anaesthesia; Epidural anaesthesia; Airway management; Rapid sequence induction; Malignant hyperthermia; Cardiopulmonary resuscitation; Mechanical ventilation; Oxygen therapy; Fluid resuscitation; Pain management; Sedation"),
      g("Radiology and emergency", "Chest X-ray interpretation; CT scan principles; MRI principles; Ultrasound principles; Contrast agents; Radiation protection; Triage; Anaphylaxis management; Snake bite management; Organophosphate poisoning; Paracetamol overdose; Drowning; Heat stroke; Hypothermia"),
    ],
  },
  {
    id: "forensic", name: "Forensic Medicine and Toxicology", program: "MBBS",
    aspects: ["{e}: medicolegal principles", "{e}: findings and interpretation", "{e}: investigations and samples", "{e}: management", "{e}: legal procedure"],
    groups: [
      g("Forensic medicine", "Postmortem changes; Time since death; Rigor mortis; Livor mortis; Asphyxial deaths; Hanging; Strangulation; Drowning deaths; Firearm injuries; Blunt force injuries; Sharp force injuries; Burns and scalds; Electrocution; Identification of the dead; Age estimation; Sexual offences examination; Medical negligence; Informed consent; Inquest procedures; Dying declaration; Autopsy technique; Injury certificate"),
      g("Toxicology", "Organophosphate poisoning toxicity; Carbon monoxide poisoning; Opium poisoning; Alcohol poisoning; Methanol poisoning; Arsenic poisoning; Snake venom toxicity; Cyanide poisoning"),
    ],
  },
  {
    id: "community", name: "Community Medicine", program: "MBBS",
    aspects: ["{e}: concept and definitions", "{e}: epidemiology", "{e}: prevention and control", "{e}: programme and policy", "{e}: worked example"],
    groups: [
      g("Epidemiology and biostatistics", "Study designs; Cohort studies; Case-control studies; Randomised controlled trials; Screening tests; Sensitivity and specificity; Bias and confounding; Measures of disease frequency; Normal distribution; Hypothesis testing; Sampling methods; Confidence intervals; Correlation and regression; Surveillance systems; Outbreak investigation; Life tables; Vital statistics; Levels of prevention; Epidemiological transition"),
      g("Public health", "Nutrition programmes; Maternal and child health; Immunisation programmes; Water purification; Sanitation and excreta disposal; Occupational health; Environmental health; Health education; Primary health care; Health system structure; Communicable disease control; Non-communicable disease control; Demography and family planning; Disaster management; Mental health in the community; Vector-borne diseases; Zoonoses; Biomedical waste in the community"),
    ],
  },
  {
    id: "dental-anatomy", name: "Dental Anatomy and Oral Biology", program: "BDS",
    aspects: ["{e}: morphology and features", "{e}: development and eruption", "{e}: histology and structure", "{e}: function and clinical significance", "{e}: variations and anomalies"],
    groups: [
      g("Teeth", "Maxillary central incisor; Maxillary lateral incisor; Maxillary canine; Maxillary first premolar; Maxillary first molar; Mandibular central incisor; Mandibular canine; Mandibular first premolar; Mandibular first molar; Mandibular second molar; Deciduous incisors; Deciduous molars; Third molar; Occlusion; Tooth numbering systems; Dental arches"),
      g("Oral tissues", "Enamel; Dentine; Dental pulp; Cementum; Periodontal ligament; Alveolar bone; Gingiva; Oral mucosa; Tooth eruption; Odontogenesis; Salivary glands in the mouth; Saliva composition; Temporomandibular joint function; Mastication; Dental lamina and tooth bud"),
    ],
  },
  {
    id: "oral-pathology", name: "Oral Pathology and Oral Medicine", program: "BDS",
    aspects: ["{e}: aetiology and pathogenesis", "{e}: clinical features", "{e}: histopathology", "{e}: diagnosis and investigations", "{e}: treatment and prognosis"],
    groups: [
      g("Dental and jaw lesions", "Dental caries; Pulpitis; Periapical abscess; Periapical granuloma; Radicular cyst; Dentigerous cyst; Odontogenic keratocyst; Ameloblastoma; Odontogenic myxoma; Cementoblastoma; Fibrous dysplasia of the jaws; Cherubism; Osteomyelitis of the jaws; Dry socket; Ludwig angina; Developmental disturbances of teeth; Amelogenesis imperfecta; Dentinogenesis imperfecta"),
      g("Oral mucosal and salivary disease", "Oral leukoplakia; Oral submucous fibrosis; Oral squamous cell carcinoma; Oral lichen planus; Recurrent aphthous stomatitis; Candidiasis of the mouth; Pemphigus in the mouth; Herpetic gingivostomatitis; Pleomorphic adenoma; Mucoepidermoid carcinoma; Sjogren syndrome; Mucocele and ranula; Sialolithiasis; Burning mouth syndrome; Trigeminal neuralgia; Oral manifestations of HIV; Oral manifestations of systemic disease; Geographic tongue; Syphilis in the mouth; Oral premalignant lesions"),
    ],
  },
  {
    id: "dental-materials", name: "Dental Materials", program: "BDS",
    aspects: ["{e}: composition and setting reaction", "{e}: properties and selection", "{e}: manipulation technique", "{e}: advantages and limitations", "{e}: failures and troubleshooting"],
    groups: [
      g("Restorative and impression materials", "Dental amalgam; Composite resin; Glass ionomer cement; Resin-modified glass ionomer; Zinc phosphate cement; Zinc oxide eugenol; Calcium hydroxide liners; Dental ceramics; Zirconia; Dental adhesives; Alginate; Elastomeric impression materials; Impression compound; Gypsum products; Dental waxes; Acrylic resins; Cast metal alloys; Orthodontic wires; Dental investments; Endodontic sealers; Gutta-percha; Dental implants materials; Bleaching agents; Pit and fissure sealants; Mineral trioxide aggregate; Silicone elastomers; Denture base materials; Soldering and welding; Corrosion in the mouth; Finishing and polishing materials"),
    ],
  },
  {
    id: "periodontology", name: "Periodontology and Oral Surgery", program: "BDS",
    aspects: ["{e}: aetiology and classification", "{e}: clinical features", "{e}: diagnosis and radiographs", "{e}: treatment plan and technique", "{e}: complications and maintenance"],
    groups: [
      g("Periodontology", "Gingivitis; Chronic periodontitis; Aggressive periodontitis; Necrotising periodontal disease; Gingival enlargement; Dental plaque and calculus; Periodontal pocket; Furcation involvement; Scaling and root planing; Flap surgery; Gingival recession; Mucogingival surgery; Guided tissue regeneration; Bone grafts; Dental implants; Peri-implantitis; Periodontal abscess; Occlusal trauma"),
      g("Oral and maxillofacial surgery", "Tooth extraction technique; Impacted third molar; Local anaesthesia in dentistry; Inferior alveolar nerve block; Mandibular fracture; Maxillary fracture Le Fort; Zygomatic complex fracture; Oroantral fistula; Cleft lip repair; Cleft palate repair; Orthognathic surgery; Temporomandibular joint dislocation; Maxillofacial space infections; Biopsy techniques; Pre-prosthetic surgery; Medical emergencies in the dental clinic; Haemorrhage control after extraction"),
    ],
  },
  {
    id: "dental-clinical", name: "Orthodontics, Prosthodontics, Conservative and Paediatric Dentistry", program: "BDS",
    aspects: ["{e}: principles and classification", "{e}: clinical procedure", "{e}: diagnosis and treatment planning", "{e}: materials and biomechanics", "{e}: complications and follow-up"],
    groups: [
      g("Orthodontics", "Malocclusion classification; Angle classification; Cephalometric analysis; Growth and development of the jaws; Fixed orthodontic appliances; Removable orthodontic appliances; Functional appliances; Orthodontic tooth movement; Anchorage; Space analysis; Crowding; Open bite; Cross bite; Retention and relapse; Interceptive orthodontics; Habits and malocclusion"),
      g("Prosthodontics", "Complete denture; Partial denture; Denture impression techniques; Jaw relation records; Teeth arrangement; Fixed partial denture; Crown preparation; Occlusion in prosthodontics; Maxillofacial prosthesis; Implant-supported prosthesis; Overdenture; Denture complications; Denture insertion and adjustment; Post and core"),
      g("Conservative dentistry and endodontics", "Cavity preparation principles; Class I cavity; Class II cavity; Class V cavity; Pulp capping; Root canal treatment; Working length determination; Root canal irrigants; Obturation techniques; Rubber dam isolation; Endodontic emergencies; Tooth bleaching; Dental trauma management; Apexification; Pulpotomy; Post-endodontic restoration; Endodontic surgery"),
      g("Paediatric and preventive dentistry", "Early childhood caries; Behaviour management in children; Pulpotomy in primary teeth; Space maintainers; Stainless steel crowns; Fluoride therapy; Pit and fissure sealing; Dental trauma in children; Oral habits in children; Caries risk assessment; Dental public health; Oral hygiene instructions; Dental fluorosis; Atraumatic restorative treatment"),
      g("Oral radiology", "Intraoral radiographs; Panoramic radiography; Cone beam CT in dentistry; Radiographic errors; Radiation safety in dentistry; Radiographic interpretation of caries; Radiographic interpretation of periapical lesions; Digital radiography"),
    ],
  },
];

/** Every catalog topic (discipline x group x entity x aspect), with its saved-widget key. */
export function buildCatalog(): CatalogTopic[] {
  const out: CatalogTopic[] = [];
  for (const d of CATALOG_DISCIPLINES) {
    for (const grp of d.groups) {
      for (const entity of grp.entities) {
        d.aspects.forEach((aspect, ai) => {
          const prompt = aspect.replace("{e}", entity);
          out.push({ id: `${d.id}.${out.length}`, disciplineId: d.id, discipline: d.name, program: d.program, group: grp.name, entity, aspect: aspect.replace("{e}:", "").trim() || `aspect ${ai + 1}`, prompt, key: promptKey(prompt) });
        });
      }
    }
  }
  return out;
}

let cached: CatalogTopic[] | null = null;
export function getCatalog(): CatalogTopic[] { return (cached ??= buildCatalog()); }

let keySet: Set<string> | null = null;
/** Saved-widget keys of every catalog topic. */
export function catalogKeySet(): Set<string> { return (keySet ??= new Set(getCatalog().map((t) => t.key))); }
