/* ============================================================
   Données des arbres de décision
   Chaque arbre = un nœud racine. Un nœud est soit :
   - une QUESTION : { id, question, options:[{label, next}] }
   - un RÉSULTAT  : { id, result:true, cause, action, escalade }
   ============================================================ */

const DECISION_TREES = [
  {
    id: "cell-down",
    title: "Cell / Site Unavailable",
    subtitle: "Cellule ou site indisponible",
    severity: "critical",
    start: "q1",
    nodes: {
      q1: {
        question: "Le SITE entier est down, ou juste UNE cellule ?",
        options: [
          { label: "Tout le site est down", next: "q2" },
          { label: "Une seule cellule", next: "q5" }
        ]
      },
      q2: {
        question: "Y a-t-il une alarme de TRANSMISSION (S1 / SCTP / Link Fault) ?",
        options: [
          { label: "Oui", next: "r-transmission" },
          { label: "Non", next: "q3" }
        ]
      },
      q3: {
        question: "Y a-t-il une alarme POWER (AC / Mains Failure) ?",
        options: [
          { label: "Oui", next: "r-power" },
          { label: "Non", next: "q4" }
        ]
      },
      q4: {
        question: "Y a-t-il une alarme matérielle (Board / BBU Fault) ?",
        options: [
          { label: "Oui", next: "r-hardware" },
          { label: "Non (vérifier horloge/licence)", next: "r-noc2" }
        ]
      },
      q5: {
        question: "Alarme RRU ou CPRI sur ce secteur ?",
        options: [
          { label: "Oui", next: "r-rru" },
          { label: "Non", next: "q6" }
        ]
      },
      q6: {
        question: "La cellule est-elle BLOQUÉE ? (vérifier : DSP CELL)",
        options: [
          { label: "Oui", next: "r-unblock" },
          { label: "Non", next: "q7" }
        ]
      },
      q7: {
        question: "Y a-t-il eu un changement de config récent ? (logs CM)",
        options: [
          { label: "Oui", next: "r-config" },
          { label: "Non", next: "r-reset" }
        ]
      },
      "r-transmission": { result: true, cause: "Coupure de transmission", action: "Escalader vers l'équipe Transmission. Vérifier d'abord la portée (DSP IPPATH, DSP SCTPLNK, PING).", escalade: "Équipe Transmission" },
      "r-power": { result: true, cause: "Panne d'alimentation", action: "Vérifier secteur et batteries. Le site est sur batterie : intervenir avant extinction.", escalade: "Énergie / Field" },
      "r-hardware": { result: true, cause: "Panne matérielle (carte / BBU)", action: "Demande d'intervention terrain pour remplacement de la carte défaillante.", escalade: "Field / Terrain" },
      "r-noc2": { result: true, cause: "Cause indéterminée (horloge / licence ?)", action: "Vérifier DSP CLKSTAT et DSP LICENSE, puis escalader au niveau 2.", escalade: "NOC niveau 2" },
      "r-rru": { result: true, cause: "Tête radio / lien BBU-RRU", action: "Vérifier DSP RRU. Intervention terrain pour la RRU ou le lien CPRI.", escalade: "Field / Terrain" },
      "r-unblock": { result: true, cause: "Cellule bloquée manuellement", action: "Débloquer la cellule : UBL CELL puis ACT CELL.", escalade: "Action directe NOC" },
      "r-config": { result: true, cause: "Erreur de configuration récente", action: "Annuler / corriger le paramètre fautif (MOD CELL). Revérifier après.", escalade: "NOC N2 / Optimisation" },
      "r-reset": { result: true, cause: "Anomalie logicielle", action: "Reset contrôlé de la carte (RST BRD) en fenêtre de maintenance.", escalade: "NOC niveau 2" }
    }
  },
  {
    id: "transmission",
    title: "Transmission / Link Failure",
    subtitle: "S1, SCTP, IP Path down",
    severity: "critical",
    start: "q1",
    nodes: {
      q1: {
        question: "Combien de sites sont impactés ?",
        options: [
          { label: "Plusieurs sites", next: "r-backbone" },
          { label: "Un seul site", next: "q2" }
        ]
      },
      q2: {
        question: "Test de connectivité — le PING vers le site répond-il ?",
        options: [
          { label: "Échec total du ping", next: "r-physical" },
          { label: "Ping OK mais SCTP down", next: "q3" }
        ]
      },
      q3: {
        question: "L'équipement de transmission a-t-il une alarme ?",
        options: [
          { label: "Oui", next: "r-equip" },
          { label: "Non", next: "r-config" }
        ]
      },
      "r-backbone": { result: true, cause: "Coupure sur un lien agrégé (fibre / FH backbone)", action: "Escalade URGENTE : impact massif sur plusieurs sites.", escalade: "Transmission (urgent)" },
      "r-physical": { result: true, cause: "Lien physique coupé (fibre / FH)", action: "Escalader à l'équipe transmission pour intervention sur le lien.", escalade: "Équipe Transmission" },
      "r-equip": { result: true, cause: "Panne d'équipement de transmission", action: "Intervention terrain sur l'équipement de transport.", escalade: "Field / Transport" },
      "r-config": { result: true, cause: "Problème de configuration IP / SCTP", action: "Vérifier la config IP/SCTP (changement récent ?) ou escalader.", escalade: "NOC N2 / Transport" }
    }
  },
  {
    id: "power",
    title: "Power / Mains Failure",
    subtitle: "Panne d'alimentation — ⏳ urgent",
    severity: "critical",
    start: "q1",
    nodes: {
      q1: {
        question: "Coupure secteur générale dans la zone ?",
        options: [
          { label: "Oui", next: "r-grid" },
          { label: "Non", next: "q2" }
        ]
      },
      q2: {
        question: "Alarme sur le redresseur / module power ?",
        options: [
          { label: "Oui", next: "r-equip" },
          { label: "Non", next: "q3" }
        ]
      },
      q3: {
        question: "État des batteries ? (alarme Low Battery ?)",
        options: [
          { label: "Batterie faible", next: "r-urgent" },
          { label: "Batterie OK", next: "r-plan" }
        ]
      },
      "r-grid": { result: true, cause: "Panne du réseau électrique local/national", action: "Activer le groupe électrogène et surveiller l'autonomie batterie.", escalade: "Énergie / Field" },
      "r-equip": { result: true, cause: "Panne de l'équipement d'alimentation", action: "Intervention terrain sur le redresseur / module power.", escalade: "Field / Terrain" },
      "r-urgent": { result: true, cause: "Batterie faible — extinction imminente", action: "PRIORITÉ MAX : intervention immédiate avant coupure totale du site.", escalade: "Field (urgent)" },
      "r-plan": { result: true, cause: "Coupure secteur, site sur batterie (autonomie OK)", action: "Planifier l'intervention et suivre l'autonomie restante.", escalade: "Énergie / Field" }
    }
  },
  {
    id: "vswr",
    title: "VSWR Alarm",
    subtitle: "Problème antenne / câble",
    severity: "major",
    start: "q1",
    nodes: {
      q1: {
        question: "La valeur VSWR est-elle Critical ou Major ?",
        options: [
          { label: "Critical (la radio peut se couper)", next: "q2" },
          { label: "Major (dégradation)", next: "q2" }
        ]
      },
      q2: {
        question: "Apparue après une intempérie / un orage ?",
        options: [
          { label: "Oui", next: "r-water" },
          { label: "Non", next: "q3" }
        ]
      },
      q3: {
        question: "Apparue après une intervention récente sur le site ?",
        options: [
          { label: "Oui", next: "r-install" },
          { label: "Non", next: "r-feeder" }
        ]
      },
      "r-water": { result: true, cause: "Infiltration d'eau / connecteur corrodé", action: "Intervention terrain : inspection des connecteurs et étanchéité.", escalade: "Field / Terrain" },
      "r-install": { result: true, cause: "Connecteur mal serré / jumper mal posé", action: "Reprise de l'installation (resserrage, vérification jumper).", escalade: "Field / Terrain" },
      "r-feeder": { result: true, cause: "Câble feeder / antenne / connecteur défectueux", action: "Test du feeder et remplacement du connecteur ou de l'antenne.", escalade: "Field / Terrain" }
    }
  },
  {
    id: "clock",
    title: "Clock / GPS Sync",
    subtitle: "Perte de synchronisation",
    severity: "major",
    start: "q1",
    nodes: {
      q1: {
        question: "Source de synchro perdue ? (DSP CLKSTAT / DSP CLKSRC)",
        options: [
          { label: "Oui, continuer le diagnostic", next: "q2" }
        ]
      },
      q2: {
        question: "Alarme sur l'antenne GPS ?",
        options: [
          { label: "Oui", next: "r-gps" },
          { label: "Non", next: "q3" }
        ]
      },
      q3: {
        question: "Synchro réseau (IEEE1588 / transport) perdue ?",
        options: [
          { label: "Oui", next: "r-transport" },
          { label: "Non", next: "r-restore" }
        ]
      },
      "r-gps": { result: true, cause: "Câble / antenne GPS défectueux", action: "Intervention terrain sur l'antenne GPS. ⚠️ Sans synchro : handovers échouent + coupure à terme.", escalade: "Field / Terrain" },
      "r-transport": { result: true, cause: "Perte de synchro côté transmission", action: "Escalader au transport pour restaurer la synchro réseau.", escalade: "Transport" },
      "r-restore": { result: true, cause: "Perte de référence d'horloge", action: "Restaurer la source d'horloge avant expiration du holdover.", escalade: "NOC N2" }
    }
  },
  {
    id: "temperature",
    title: "Temperature / Environment",
    subtitle: "Surchauffe du site",
    severity: "major",
    start: "q1",
    nodes: {
      q1: {
        question: "La climatisation est-elle en panne ? (alarme clim)",
        options: [
          { label: "Oui", next: "r-clim" },
          { label: "Non", next: "q2" }
        ]
      },
      q2: {
        question: "La porte du shelter est-elle ouverte ? (Door alarm)",
        options: [
          { label: "Oui", next: "r-door" },
          { label: "Non", next: "r-cooling" }
        ]
      },
      "r-clim": { result: true, cause: "Climatisation en panne", action: "Intervention RAPIDE : réparer/relancer la clim. ⚠️ Risque de coupure auto par surchauffe.", escalade: "Field / Terrain" },
      "r-door": { result: true, cause: "Porte ouverte (intervention ou intrusion)", action: "Vérifier s'il y a une intervention prévue, sinon traiter comme intrusion/vol.", escalade: "Sécurité / Field" },
      "r-cooling": { result: true, cause: "Système de refroidissement défaillant", action: "Intervention rapide pour rétablir le refroidissement.", escalade: "Field / Terrain" }
    }
  },
  {
    id: "congestion",
    title: "Cell Congestion",
    subtitle: "Saturation / capacité",
    severity: "minor",
    start: "q1",
    nodes: {
      q1: {
        question: "Saturation permanente ou seulement aux heures de pointe ?",
        options: [
          { label: "Heures de pointe", next: "r-capacity" },
          { label: "Permanente", next: "q2" }
        ]
      },
      q2: {
        question: "Une cellule voisine est-elle down ? (report de trafic)",
        options: [
          { label: "Oui", next: "r-neighbor" },
          { label: "Non", next: "r-real" }
        ]
      },
      "r-capacity": { result: true, cause: "Manque de capacité aux heures de pointe", action: "Activer une porteuse/fréquence, load balancing, ou recommander un upgrade capacité.", escalade: "Planification / Optimisation" },
      "r-neighbor": { result: true, cause: "Report de trafic d'une cellule voisine en panne", action: "Traiter d'abord la cellule en panne : la charge se rééquilibrera.", escalade: "NOC / Field" },
      "r-real": { result: true, cause: "Manque de capacité réel", action: "Activer une fréquence supplémentaire, load balancing, ou recommander un nouveau site.", escalade: "Planification / Optimisation" }
    }
  }
];

/* Index de recherche global (alimente la barre de recherche) */
const SEARCH_INDEX = [
  { t: "Le métier d'analyste réseau", c: "Métier", h: "#metier" },
  { t: "Compétences BI appliquées au réseau", c: "Métier", h: "#metier" },
  { t: "NetAct (Nokia) — OSS", c: "Outils", h: "#outils" },
  { t: "U2020 (Huawei) — OSS", c: "Outils", h: "#outils" },
  { t: "NetAct Reporter — KPI", c: "Outils", h: "#outils" },
  { t: "Performance Management U2020", c: "Outils", h: "#outils" },
  { t: "Commandes MML Huawei", c: "MML", h: "#mml" },
  { t: "DSP ALMAF — alarmes actives", c: "MML", h: "#mml" },
  { t: "DSP CELL — état cellule", c: "MML", h: "#mml" },
  { t: "BLK / UBL CELL — bloquer/débloquer", c: "MML", h: "#mml" },
  { t: "Cell / Site Unavailable", c: "Alarme", h: "#alarmes" },
  { t: "Transmission / Link Failure", c: "Alarme", h: "#alarmes" },
  { t: "Power / Mains Failure", c: "Alarme", h: "#alarmes" },
  { t: "VSWR — antenne / câble", c: "Alarme", h: "#alarmes" },
  { t: "Clock / GPS Synchronization", c: "Alarme", h: "#alarmes" },
  { t: "Cell Congestion — saturation", c: "Alarme", h: "#alarmes" },
  { t: "Arbres de décision interactifs", c: "Diagnostic", h: "#arbres" },
  { t: "KPI : CSSR, DCR, PRB, HOSR", c: "KPI", h: "#kpi" },
  { t: "Certification HCIA-5G", c: "Certifs", h: "#certifs" },
  { t: "Parcours BI vers analyste réseau", c: "Certifs", h: "#certifs" },
  { t: "Architecture réseau : RAN, Transmission, Cœur", c: "Architecture", h: "#archi" },
  { t: "BBU, RRU, CPRI, eNodeB, gNodeB", c: "Architecture", h: "#archi" },
  { t: "Processus de résolution d'incident", c: "Incident", h: "#process" },
  { t: "Étapes : détection, diagnostic, résolution, clôture", c: "Incident", h: "#process" },
  { t: "Niveaux d'escalade N1 / N2 / N3", c: "Incident", h: "#process" },
  { t: "Modèle de ticket / trouble report", c: "Incident", h: "#process" },
  { t: "Boîte à outils complète de l'analyste", c: "Outils", h: "#boite" },
  { t: "Drive Test : TEMS, Nemo, XCAL", c: "Outils", h: "#boite" },
  { t: "Atoll — planification radio", c: "Outils", h: "#boite" },
  { t: "Checklist quotidienne / routine NOC", c: "Routine", h: "#routine" },
  { t: "Glossaire des acronymes télécom", c: "Glossaire", h: "#glossaire" },
  { t: "RSRP, RSRQ, SINR — qualité radio", c: "Glossaire", h: "#glossaire" },
  { t: "Comparatif 2G 3G 4G 5G", c: "Générations", h: "#generations" },
  { t: "Focus 5G : NSA, SA, gNodeB, slicing", c: "Générations", h: "#generations" },
  { t: "Optimisation radio : tilt, azimut, puissance", c: "Optimisation", h: "#optim" },
  { t: "Handover, réutilisation de fréquences", c: "Optimisation", h: "#optim" },
  { t: "Correspondance alarmes Huawei Nokia", c: "Alarmes", h: "#mapping" },
  { t: "Commandes MML détaillées (syntaxe + sortie)", c: "MML", h: "#mml" },
  { t: "Préparation entretien analyste réseau", c: "Entretien", h: "#entretien" },
  { t: "Questions réponses entretien KPI alarmes", c: "Entretien", h: "#entretien" },
  { t: "KPI seuils cibles et formules", c: "KPI", h: "#kpi" }
];

/* ============================================================
   Processus de résolution d'incident — cycle de vie complet
   ============================================================ */
const INCIDENT_PROCESS = [
  {
    phase: "1", icon: "🔔", title: "Détection",
    goal: "Repérer le problème le plus tôt possible.",
    actions: [
      "Surveiller les alarmes OSS en temps réel (Monitor / Fault Management)",
      "Recevoir une alerte automatique (seuil KPI dépassé)",
      "Recevoir une plainte client / remontée terrain",
      "Détecter une dégradation sur un dashboard de performance"
    ],
    tools: ["NetAct Monitor", "U2020 Fault Mgmt", "Dashboards (Power BI / Grafana)", "Tickets clients"],
    actors: "NOC niveau 1 (supervision)",
    output: "Un incident est créé (ouverture d'un ticket).",
    sla: "Détection : temps réel / quelques minutes"
  },
  {
    phase: "2", icon: "🏷️", title: "Qualification & priorisation",
    goal: "Classer l'incident pour savoir quoi traiter en premier.",
    actions: [
      "Évaluer la SÉVÉRITÉ (Critical / Major / Minor)",
      "Évaluer la PORTÉE (site entier > une cellule)",
      "Évaluer l'IMPACT CLIENT (zone dense/stratégique > zone rurale)",
      "Attribuer une priorité (P1 / P2 / P3) et un délai cible (SLA)"
    ],
    tools: ["Référentiel de sévérité", "Outil de ticketing (Remedy, ServiceNow…)"],
    actors: "NOC niveau 1",
    output: "Incident priorisé (P1/P2/P3) avec un SLA associé.",
    sla: "P1 (critique) : prise en charge immédiate"
  },
  {
    phase: "3", icon: "🔍", title: "Diagnostic & localisation",
    goal: "Trouver la CAUSE RACINE, pas seulement le symptôme.",
    actions: [
      "Identifier l'alarme racine (écarter les alarmes 'enfants')",
      "Descendre dans la hiérarchie : Site → BBU → Carte → RRU → Antenne",
      "Confirmer avec les KPI (trafic/dispo avant-après l'incident)",
      "Croiser alarmes + KPI + logs (corrélation)",
      "Lancer les commandes de diagnostic (DSP CELL, DSP RRU, PING…)"
    ],
    tools: ["Commandes MML", "Arbres de décision", "Performance Mgmt / Reporter", "Logs système"],
    actors: "NOC niveau 1 → niveau 2 si complexe",
    output: "Cause racine identifiée + nature (transmission / power / matériel / config).",
    sla: "Étape clé — là où le profil BI/data fait la différence"
  },
  {
    phase: "4", icon: "🧭", title: "Décision & plan d'action",
    goal: "Choisir l'action corrective et qui doit l'exécuter.",
    actions: [
      "Décider : action à distance (NOC) ou intervention terrain ?",
      "Identifier l'équipe à mobiliser (escalade)",
      "Préparer un Change Request si modification de config",
      "Planifier une fenêtre de maintenance si action impactante"
    ],
    tools: ["Procédures / runbooks", "Outil de change management", "Matrice d'escalade"],
    actors: "NOC N2 / responsable d'astreinte",
    output: "Plan d'action validé + équipe assignée.",
    sla: "Respecter le SLA de la priorité"
  },
  {
    phase: "5", icon: "🔧", title: "Résolution & intervention",
    goal: "Exécuter la correction.",
    actions: [
      "Action à distance : MOD CELL, RST BRD, UBL CELL, reconfiguration…",
      "Intervention terrain : remplacement carte/RRU/antenne, réparation alim",
      "Escalade transmission : réparation fibre / faisceau hertzien",
      "Suivre l'avancement et tenir le ticket à jour"
    ],
    tools: ["Commandes MML", "Équipe Field", "Équipe Transmission", "Pièces de rechange"],
    actors: "NOC N2 / N3, Field, Transmission, Énergie",
    output: "Correction appliquée.",
    sla: "⚠️ Actions impactantes uniquement en fenêtre validée"
  },
  {
    phase: "6", icon: "✅", title: "Vérification & validation",
    goal: "Confirmer que le service est réellement rétabli.",
    actions: [
      "Vérifier l'état : DSP CELL → la cellule est-elle UP ?",
      "Vérifier que les alarmes ont disparu",
      "Contrôler les KPI : le trafic / la dispo sont-ils remontés ?",
      "Au besoin, valider sur le terrain (Drive Test)"
    ],
    tools: ["Commandes MML", "Dashboards KPI", "Drive Test"],
    actors: "NOC niveau 1/2",
    output: "Service confirmé rétabli (sinon → retour à l'étape 3).",
    sla: "Pas de clôture sans confirmation KPI"
  },
  {
    phase: "7", icon: "📁", title: "Clôture & retour d'expérience",
    goal: "Documenter et capitaliser.",
    actions: [
      "Renseigner la cause racine et l'action dans le ticket",
      "Clôturer l'incident dans l'outil de ticketing",
      "Rédiger un rapport post-incident pour les P1 (RCA)",
      "Identifier les actions préventives (récurrence ?)"
    ],
    tools: ["Outil de ticketing", "Rapport RCA", "Base de connaissances"],
    actors: "NOC + management",
    output: "Incident clôturé + leçons apprises (préventif).",
    sla: "RCA sous 48–72h pour les incidents majeurs"
  }
];

/* Niveaux d'escalade */
const ESCALATION = [
  { lvl: "N1", name: "NOC niveau 1 — Supervision", role: "Surveille, qualifie, traite les incidents simples et les actions à distance standard. Première ligne 24/7.", examples: "Débloquer une cellule, redémarrer à distance, créer/suivre les tickets." },
  { lvl: "N2", name: "NOC niveau 2 — Expertise", role: "Diagnostics complexes, reconfiguration, corrélation avancée. Prend le relais quand N1 est bloqué.", examples: "Analyse de cause racine difficile, changement de paramètres, coordination multi-équipes." },
  { lvl: "N3", name: "Niveau 3 — Experts / Vendeur", role: "Cas rares et profonds : bug logiciel, défaut équipement, support de l'équipementier (Huawei/Nokia).", examples: "Patch logiciel, expertise R&D, remontée au support constructeur." },
  { lvl: "Field", name: "Équipe terrain", role: "Interventions physiques sur site.", examples: "Remplacer une carte/RRU/antenne, réparer l'alimentation, resserrer un connecteur." },
  { lvl: "Trans.", name: "Équipe Transmission", role: "Liens entre sites (fibre, faisceaux hertziens).", examples: "Réparer une coupure fibre, restaurer un FH, synchro transport." }
];

/* Glossaire des acronymes */
const GLOSSARY = [
  { term: "OSS", def: "Operations Support System — plateforme centrale de gestion du réseau (NetAct, U2020).", cat: "Système" },
  { term: "RAN", def: "Radio Access Network — partie radio du réseau (sites, antennes) qui relie l'abonné au cœur.", cat: "Architecture" },
  { term: "BBU", def: "BaseBand Unit — unité de traitement bande de base, le 'cerveau' de la station de base.", cat: "Équipement" },
  { term: "RRU", def: "Remote Radio Unit — tête radio déportée, près de l'antenne, qui émet/reçoit le signal.", cat: "Équipement" },
  { term: "CPRI", def: "Common Public Radio Interface — lien (fibre) entre la BBU et la RRU.", cat: "Équipement" },
  { term: "eNodeB", def: "Station de base 4G/LTE.", cat: "Équipement" },
  { term: "gNodeB", def: "Station de base 5G NR.", cat: "Équipement" },
  { term: "NodeB / BTS", def: "Station de base 3G (NodeB) / 2G (BTS).", cat: "Équipement" },
  { term: "Cell", def: "Cellule — zone de couverture d'un secteur d'antenne. Un site a plusieurs cellules.", cat: "Architecture" },
  { term: "Core / EPC", def: "Cœur de réseau — gère l'authentification, la mobilité et l'acheminement (EPC en 4G, 5GC en 5G).", cat: "Architecture" },
  { term: "S1", def: "Interface entre l'eNodeB (4G) et le cœur de réseau (EPC).", cat: "Interface" },
  { term: "SCTP", def: "Protocole de transport de la signalisation entre le site et le cœur.", cat: "Interface" },
  { term: "KPI", def: "Key Performance Indicator — indicateur de performance du réseau.", cat: "Performance" },
  { term: "CSSR", def: "Call Setup Success Rate — taux de réussite d'établissement d'appel (accessibilité).", cat: "Performance" },
  { term: "DCR", def: "Drop Call Rate — taux de coupure d'appel (rétention).", cat: "Performance" },
  { term: "PRB", def: "Physical Resource Block — unité de ressource radio en LTE/5G. Son taux d'usage = niveau de saturation.", cat: "Performance" },
  { term: "HOSR", def: "Handover Success Rate — taux de réussite du passage d'une cellule à l'autre (mobilité).", cat: "Performance" },
  { term: "RRC", def: "Radio Resource Control — protocole de connexion radio. RRC Setup SR = réussite de connexion.", cat: "Performance" },
  { term: "Throughput", def: "Débit moyen de données — mesure de l'expérience data de l'abonné.", cat: "Performance" },
  { term: "RSRP", def: "Reference Signal Received Power — puissance du signal reçu (niveau de couverture).", cat: "Radio" },
  { term: "RSRQ", def: "Reference Signal Received Quality — qualité du signal reçu.", cat: "Radio" },
  { term: "SINR", def: "Signal to Interference plus Noise Ratio — rapport signal/bruit (qualité radio).", cat: "Radio" },
  { term: "VSWR", def: "Voltage Standing Wave Ratio — indicateur d'adaptation antenne/câble. Une alarme VSWR = problème antenne/feeder.", cat: "Radio" },
  { term: "Tilt", def: "Inclinaison de l'antenne (mécanique ou électrique), ajustée pour optimiser la couverture.", cat: "Radio" },
  { term: "Handover", def: "Transfert d'une communication d'une cellule à une autre quand l'abonné se déplace.", cat: "Radio" },
  { term: "MML", def: "Man-Machine Language — langage de commandes Huawei (verbe + objet, ex. DSP CELL).", cat: "Système" },
  { term: "FCAPS", def: "Fault, Configuration, Accounting, Performance, Security — les 5 domaines de gestion d'un OSS.", cat: "Système" },
  { term: "NOC", def: "Network Operations Center — centre de supervision du réseau (où travaille l'analyste, souvent 24/7).", cat: "Organisation" },
  { term: "SLA", def: "Service Level Agreement — délai/qualité de service contractuel à respecter.", cat: "Organisation" },
  { term: "RCA", def: "Root Cause Analysis — analyse de cause racine, rapport rédigé après un incident majeur.", cat: "Organisation" },
  { term: "SON", def: "Self-Organizing Network — automatisation de l'optimisation du réseau.", cat: "Organisation" },
  { term: "FH", def: "Faisceau Hertzien — liaison radio point-à-point entre deux sites (alternative à la fibre).", cat: "Transmission" },
  { term: "Feeder", def: "Câble reliant la radio à l'antenne. Un défaut de feeder déclenche souvent une alarme VSWR.", cat: "Équipement" },
  { term: "Shelter", def: "Local technique abritant les équipements d'un site (avec climatisation, batteries).", cat: "Équipement" }
];

/* ============================================================
   Cas pratiques chiffrés — incidents résolus de bout en bout
   ============================================================ */
const CASE_STUDIES = [
  {
    id: "c1", tag: "Saturation", sev: "minor",
    title: "Débit 4G faible dans un quartier dense",
    context: "Site LTE_Dakar_Plateau, secteur 2. Plaintes d'abonnés : Internet lent en soirée.",
    symptom: "Débit data ressenti très faible entre 19h et 23h.",
    kpisBefore: [
      { k: "Disponibilité cellule", v: "100 %", ok: true },
      { k: "Alarmes actives", v: "Aucune", ok: true },
      { k: "PRB Utilization (pic)", v: "98 %", ok: false },
      { k: "Throughput DL moyen", v: "1,8 Mbps", ok: false },
      { k: "Nb utilisateurs RRC (pic)", v: "210", ok: false }
    ],
    steps: [
      "Détection : plaintes clients + dashboard débit en baisse le soir",
      "Diagnostic : disponibilité OK, AUCUNE alarme → ce n'est pas une panne",
      "On regarde les KPI de charge : PRB Utilization à 98 % aux heures de pointe",
      "Corrélation : le débit chute exactement quand la charge est max → saturation"
    ],
    cause: "Saturation de la cellule (manque de capacité aux heures de pointe), pas de panne.",
    action: "Activation d'une 2ᵉ porteuse (carrier aggregation) + rééquilibrage de charge vers cellules voisines.",
    kpisAfter: [
      { k: "PRB Utilization (pic)", v: "61 %", ok: true },
      { k: "Throughput DL moyen", v: "12,4 Mbps", ok: true },
      { k: "Plaintes clients", v: "0", ok: true }
    ],
    duration: "Résolu en 2 jours (planification capacité)",
    escalade: "Planification / Optimisation"
  },
  {
    id: "c2", tag: "Transmission", sev: "critical",
    title: "Site entier injoignable la nuit",
    context: "Site 4G_Thies_Nord. Détecté à 03h12 par alarme automatique.",
    symptom: "Toutes les cellules du site portent 0 trafic depuis 03h12.",
    kpisBefore: [
      { k: "Disponibilité site", v: "0 %", ok: false },
      { k: "Alarme racine", v: "S1 Link Failure", ok: false },
      { k: "Ping vers site", v: "Échec total", ok: false },
      { k: "Trafic (Erlang)", v: "0", ok: false }
    ],
    steps: [
      "Détection : alarme automatique 'Cell Unavailable' sur les 3 cellules à 03h12",
      "Qualification : site entier down → P1 (critique)",
      "Diagnostic : on cherche l'alarme racine → 'S1 Link Failure' (pas 'cell down' qui est l'enfant)",
      "Test PING vers le site : échec total → lien physique coupé",
      "Confirmation : un seul site impacté, équipement transmission en alarme"
    ],
    cause: "Coupure du faisceau hertzien (FH) alimentant le site — panne de l'équipement de transmission.",
    action: "Escalade équipe Transmission → redémarrage de l'équipement FH défaillant sur site.",
    kpisAfter: [
      { k: "Disponibilité site", v: "100 %", ok: true },
      { k: "Ping vers site", v: "OK", ok: true },
      { k: "Trafic (Erlang)", v: "Nominal", ok: true }
    ],
    duration: "Rétabli en 1h40 (intervention terrain de nuit)",
    escalade: "Transmission + Field"
  },
  {
    id: "c3", tag: "Antenne", sev: "major",
    title: "Couverture dégradée sur un secteur après un orage",
    context: "Site 4G_Mbour_Plage, secteur 1. Lendemain d'un fort orage.",
    symptom: "Zone de couverture réduite, appels coupés en bordure de cellule.",
    kpisBefore: [
      { k: "Alarme", v: "VSWR (Major)", ok: false },
      { k: "RSRP moyen (bord)", v: "-118 dBm", ok: false },
      { k: "DCR (taux coupure)", v: "4,7 %", ok: false },
      { k: "Puissance émise effective", v: "réduite (protection)", ok: false }
    ],
    steps: [
      "Détection : alarme VSWR Major sur le secteur 1",
      "Diagnostic : alarme apparue juste après l'orage → suspicion infiltration d'eau",
      "Corrélation KPI : DCR monté à 4,7 % (vs 0,8 % normal), RSRP dégradé en bordure",
      "La radio réduit sa puissance pour se protéger → couverture rétrécie"
    ],
    cause: "Infiltration d'eau dans un connecteur du feeder → désadaptation antenne (VSWR élevé).",
    action: "Intervention terrain : remplacement du connecteur + étanchéité refaite.",
    kpisAfter: [
      { k: "Alarme VSWR", v: "Disparue", ok: true },
      { k: "RSRP moyen (bord)", v: "-104 dBm", ok: true },
      { k: "DCR (taux coupure)", v: "0,8 %", ok: true }
    ],
    duration: "Résolu en 6h (intervention terrain le jour même)",
    escalade: "Field / Terrain"
  },
  {
    id: "c4", tag: "Énergie", sev: "critical",
    title: "Coupure secteur — course contre la batterie",
    context: "Site rural 2G/4G_Tamba_Est. Détecté à 14h05.",
    symptom: "Alarme Mains Failure : le site est passé sur batterie.",
    kpisBefore: [
      { k: "Alarme", v: "AC Mains Failure", ok: false },
      { k: "Source d'alimentation", v: "Batterie", ok: false },
      { k: "Autonomie estimée", v: "~4 h", ok: false },
      { k: "Disponibilité site", v: "100 % (pour l'instant)", ok: true }
    ],
    steps: [
      "Détection : alarme 'AC Mains Failure' → site sur batterie, compte à rebours lancé",
      "Qualification : pas encore de coupure, mais P1 (risque d'extinction)",
      "Diagnostic : coupure secteur générale dans la zone (confirmée)",
      "Décision : mobiliser un groupe électrogène avant épuisement batterie"
    ],
    cause: "Coupure du réseau électrique local (fréquent en zone rurale).",
    action: "Déploiement d'un groupe électrogène mobile + suivi de l'autonomie batterie jusqu'au relais.",
    kpisAfter: [
      { k: "Source d'alimentation", v: "Groupe électrogène", ok: true },
      { k: "Disponibilité site", v: "100 % (jamais coupé)", ok: true },
      { k: "Alarme batterie", v: "Aucune", ok: true }
    ],
    duration: "Groupe en place en 2h30, avant épuisement batterie",
    escalade: "Énergie / Field"
  },
  {
    id: "c5", tag: "Interférences", sev: "major",
    title: "Coupures fréquentes malgré un bon niveau de signal",
    context: "Site urbain 4G_Dakar_Medina, secteur 3. Plaintes de coupures d'appel.",
    symptom: "Taux de coupure élevé alors que le niveau de signal paraît correct.",
    kpisBefore: [
      { k: "RSRP moyen", v: "-88 dBm (correct)", ok: true },
      { k: "SINR moyen", v: "2 dB", ok: false },
      { k: "DCR (taux coupure)", v: "5,2 %", ok: false },
      { k: "Alarmes", v: "Aucune", ok: true }
    ],
    steps: [
      "Détection : DCR élevé sans alarme → pas une panne",
      "Drive test : RSRP correct MAIS SINR très faible → interférences",
      "Analyse : une cellule voisine déborde (overshooting) et brouille le secteur",
      "Corrélation : la zone de SINR faible correspond au chevauchement des deux cellules"
    ],
    cause: "Interférences dues au débordement (overshooting) d'une cellule voisine + plan de fréquences sous-optimal.",
    action: "Down-tilt de la cellule voisine pour réduire son débordement + ajustement du plan de fréquences.",
    kpisAfter: [
      { k: "SINR moyen", v: "14 dB", ok: true },
      { k: "DCR (taux coupure)", v: "0,9 %", ok: true },
      { k: "Throughput DL", v: "nettement amélioré", ok: true }
    ],
    duration: "Résolu en 3 jours (analyse + ajustement + validation drive test)",
    escalade: "Optimisation"
  },
  {
    id: "c6", tag: "Mobilité", sev: "major",
    title: "Appels coupés en se déplaçant (ping-pong de handover)",
    context: "Axe routier entre les sites 4G_Rufisque_1 et 4G_Rufisque_2.",
    symptom: "Coupures quand l'abonné roule entre les deux cellules.",
    kpisBefore: [
      { k: "HOSR (réussite handover)", v: "88 %", ok: false },
      { k: "Nb de handovers", v: "Anormalement élevé", ok: false },
      { k: "DCR (taux coupure)", v: "4,0 %", ok: false }
    ],
    steps: [
      "Détection : DCR élevé sur un axe de mobilité",
      "Diagnostic : HOSR faible + nombre de handovers excessif → effet 'ping-pong'",
      "Les mobiles basculent sans arrêt entre les deux cellules en bordure",
      "Cause : seuils et hystérésis de handover mal réglés"
    ],
    cause: "Mauvais réglage des seuils / de l'hystérésis de handover entre les deux cellules.",
    action: "Ajustement des seuils de handover, de l'hystérésis et de la temporisation (time-to-trigger).",
    kpisAfter: [
      { k: "HOSR (réussite handover)", v: "98,5 %", ok: true },
      { k: "Nb de handovers", v: "Normalisé", ok: true },
      { k: "DCR (taux coupure)", v: "0,7 %", ok: true }
    ],
    duration: "Résolu en 2 jours (ajustement + validation)",
    escalade: "Optimisation"
  }
];

/* ============================================================
   Quiz de révision — auto-évaluation (type HCIA-5G)
   correct = index de la bonne réponse
   ============================================================ */
const QUIZ = [
  {
    q: "Dans une commande MML Huawei, que signifie le verbe DSP ?",
    options: ["Modifier un paramètre", "Afficher l'état dynamique (en temps réel)", "Supprimer un objet", "Bloquer une cellule"],
    correct: 1,
    explain: "DSP = Display : affiche l'état dynamique. LST affiche la configuration."
  },
  {
    q: "Quel KPI mesure le taux de coupure d'appel ?",
    options: ["CSSR", "DCR", "HOSR", "PRB Utilization"],
    correct: 1,
    explain: "DCR = Drop Call Rate. Le CSSR mesure la réussite d'établissement d'appel."
  },
  {
    q: "Une alarme VSWR indique le plus souvent un problème de…",
    options: ["Transmission (fibre)", "Alimentation électrique", "Antenne / câble feeder", "Saturation de la cellule"],
    correct: 2,
    explain: "VSWR = désadaptation entre la radio et l'antenne (câble, connecteur, infiltration d'eau)."
  },
  {
    q: "Face à une cascade d'alarmes, l'analyste doit d'abord chercher…",
    options: ["L'alarme la plus récente", "Toutes les alarmes une par une", "L'alarme racine (root cause)", "L'alarme Minor"],
    correct: 2,
    explain: "Une seule panne génère des alarmes 'enfants'. On traite la cause racine, pas les symptômes."
  },
  {
    q: "Quel élément est le « cerveau » bande de base d'un site radio ?",
    options: ["RRU", "BBU", "Feeder", "Antenne"],
    correct: 1,
    explain: "La BBU (BaseBand Unit) traite la bande de base. La RRU est la tête radio déportée."
  },
  {
    q: "PRB Utilization à 98 % aux heures de pointe indique…",
    options: ["Une panne matérielle", "Une saturation (manque de capacité)", "Un problème de transmission", "Une coupure d'alimentation"],
    correct: 1,
    explain: "Un PRB élevé sans alarme = saturation. Solution : ajouter de la capacité/fréquence."
  },
  {
    q: "Quelle est la bonne logique de priorisation des alarmes ?",
    options: ["Sévérité → Portée → Impact client", "Ordre alphabétique", "La plus ancienne d'abord", "Au hasard"],
    correct: 0,
    explain: "On trie par sévérité (Critical d'abord), puis portée (site > cellule), puis impact client."
  },
  {
    q: "Une alarme 'AC Mains Failure' signifie que le site…",
    options: ["A perdu sa synchro GPS", "Est saturé", "Fonctionne sur batterie (secteur coupé)", "A une antenne cassée"],
    correct: 2,
    explain: "Le site est passé sur batterie : compte à rebours avant extinction si non rétabli."
  },
  {
    q: "Quelle commande permet de débloquer/remettre en service une cellule ?",
    options: ["BLK CELL", "DSP CELL", "UBL CELL", "RMV CELL"],
    correct: 2,
    explain: "UBL CELL = Unblock. BLK bloque, DSP affiche l'état, RMV supprime."
  },
  {
    q: "Avant de clôturer un incident, l'analyste doit…",
    options: ["Passer au suivant immédiatement", "Confirmer le rétablissement via les KPI", "Supprimer le ticket", "Bloquer la cellule"],
    correct: 1,
    explain: "Pas de clôture sans vérification : cellule UP + KPI (trafic/dispo) remontés."
  },
  {
    q: "Le RAN désigne quelle partie du réseau ?",
    options: ["Le cœur de réseau", "La partie accès radio (sites, antennes)", "La facturation", "Internet"],
    correct: 1,
    explain: "RAN = Radio Access Network : relie l'abonné au cœur via les sites radio."
  },
  {
    q: "Une coupure de fibre sur un lien agrégé est dangereuse car…",
    options: ["Elle ne touche qu'une cellule", "Elle peut faire tomber plusieurs sites à la fois", "Elle est sans impact", "Elle se répare seule"],
    correct: 1,
    explain: "Un lien agrégé porte plusieurs sites : sa coupure a un impact massif → escalade urgente."
  },
  {
    q: "Quel support de transmission est sensible à la pluie (rain fading) ?",
    options: ["La fibre optique", "Le faisceau hertzien (FH)", "Le câble cuivre enterré", "Aucun"],
    correct: 1,
    explain: "Le faisceau hertzien (micro-ondes) peut être atténué par de fortes pluies — d'où des dégradations météo-dépendantes."
  },
  {
    q: "Que signifie SON dans un réseau mobile ?",
    options: ["Service Operation Network", "Self-Organizing Network", "Signal Optimization Node", "System Output Network"],
    correct: 1,
    explain: "SON = Self-Organizing Network : l'automatisation de la configuration, de l'optimisation et de l'auto-réparation."
  },
  {
    q: "Le Self-Healing (SON) consiste à…",
    options: ["Configurer un nouveau site", "Détecter une panne et compenser automatiquement", "Facturer les clients", "Crypter le trafic"],
    correct: 1,
    explain: "Le self-healing détecte une dégradation (ex. cellule down) et compense, par exemple en ajustant les cellules voisines."
  },
  {
    q: "Un RSRP correct mais un SINR faible indique le plus souvent…",
    options: ["Un trou de couverture", "Des interférences", "Une coupure d'alimentation", "Une licence expirée"],
    correct: 1,
    explain: "Bonne puissance (RSRP) mais signal 'sale' (SINR bas) = interférences, souvent un débordement de cellule voisine."
  },
  {
    q: "Quelle topologie de transmission protège le mieux contre une coupure ?",
    options: ["Chaîne (daisy chain)", "Anneau (ring)", "Étoile simple", "Point à point unique"],
    correct: 1,
    explain: "L'anneau offre un chemin de secours : si un lien casse, le trafic emprunte l'autre sens."
  },
  {
    q: "En 5G, le 'network slicing' permet de…",
    options: ["Augmenter la puissance d'émission", "Créer des tranches réseau virtuelles dédiées", "Réduire la fréquence", "Crypter les SMS"],
    correct: 1,
    explain: "Le slicing découpe le réseau en tranches logiques dédiées (IoT, voix critique…) avec des garanties propres."
  },
  {
    q: "Un down-tilt d'antenne sert principalement à…",
    options: ["Étendre la couverture très loin", "Réduire l'étendue d'une cellule et limiter les interférences", "Augmenter la latence", "Couper le site"],
    correct: 1,
    explain: "Incliner l'antenne vers le bas concentre la couverture près du site et réduit le débordement vers les voisines."
  },
  {
    q: "L'analyse prédictive (AIOps) en réseau sert surtout à…",
    options: ["Facturer les clients", "Anticiper saturations et pannes avant qu'elles surviennent", "Remplacer les antennes", "Crypter le trafic"],
    correct: 1,
    explain: "L'AIOps applique l'IA/la data aux logs et KPI pour détecter les anomalies et anticiper — là où un profil BI est précieux."
  },
  {
    q: "Au Sénégal, quel organisme mesure la qualité de service des opérateurs ?",
    options: ["La Sonatel", "L'ARTP", "L'UIT", "Le 3GPP"],
    correct: 1,
    explain: "L'ARTP (Autorité de Régulation des Télécommunications et des Postes) mène les campagnes de mesure et peut sanctionner."
  },
  {
    q: "Le 'taux de présence du signal' est un indicateur de…",
    options: ["Couverture", "Latence", "Facturation", "Sécurité"],
    correct: 0,
    explain: "Il indique si le signal est présent (couverture), avant même de juger la qualité du service (QoS)."
  },
  {
    q: "En 4G/5G, comment passe la voix (au lieu du cœur circuit) ?",
    options: ["Par SMS", "En IP via VoLTE / VoNR", "Par satellite", "Elle ne passe pas"],
    correct: 1,
    explain: "La voix est portée en IP (VoLTE en 4G, VoNR en 5G). Sans VoLTE, le mobile bascule en 2G/3G pour appeler (CSFB)."
  }
];

/* ============================================================
   KPI détaillés — formule + seuils cibles
   status: 'good' si la valeur respecte la cible
   ============================================================ */
const KPI_LIST = [
  { kpi: "CSSR", name: "Call Setup Success Rate", formula: "Appels établis / tentatives d'appel", target: "> 98 %", sens: "Plus haut = mieux", reveals: "Accessibilité — capacité à établir un appel." },
  { kpi: "DCR", name: "Drop Call Rate", formula: "Appels coupés / appels établis", target: "< 2 %", sens: "Plus bas = mieux", reveals: "Rétention — stabilité des communications." },
  { kpi: "Availability", name: "Disponibilité cellule/site", formula: "Temps en service / temps total", target: "> 99,5 %", sens: "Plus haut = mieux", reveals: "Fiabilité — % de temps où la cellule fonctionne." },
  { kpi: "HOSR", name: "Handover Success Rate", formula: "Handovers réussis / tentés", target: "> 97 %", sens: "Plus haut = mieux", reveals: "Mobilité — passage fluide entre cellules." },
  { kpi: "RRC Setup SR", name: "RRC Connection Success Rate", formula: "Connexions RRC réussies / tentées", target: "> 99 %", sens: "Plus haut = mieux", reveals: "Réussite de la connexion radio initiale." },
  { kpi: "PRB Util.", name: "PRB Utilization", formula: "Ressources radio utilisées / disponibles", target: "< 70 % (alerte > 80 %)", sens: "Trop haut = saturation", reveals: "Niveau de charge / saturation de la cellule." },
  { kpi: "Throughput", name: "Débit moyen DL/UL", formula: "Volume data / temps", target: "Selon techno (élevé = mieux)", sens: "Plus haut = mieux", reveals: "Qualité de l'expérience data." },
  { kpi: "RSRP", name: "Reference Signal Received Power", formula: "Mesuré par le mobile (dBm)", target: "> -105 dBm (bon)", sens: "Moins négatif = mieux", reveals: "Niveau de couverture radio." },
  { kpi: "SINR", name: "Signal to Interference + Noise Ratio", formula: "Signal / (interférence + bruit)", target: "> 10 dB (bon)", sens: "Plus haut = mieux", reveals: "Qualité radio — propreté du signal." },
  { kpi: "Latency", name: "Latence", formula: "Délai aller-retour (ms)", target: "< 50 ms (4G), < 10 ms (5G)", sens: "Plus bas = mieux", reveals: "Réactivité — important pour jeux/visio." }
];

/* ============================================================
   Comparatif des générations
   ============================================================ */
const GENERATIONS = [
  { gen: "2G", years: "1991+", usage: "Voix + SMS", debit: "~0,1 Mbps (GPRS/EDGE)", station: "BTS", core: "Circuit", note: "Encore utilisé pour la voix et l'IoT bas débit." },
  { gen: "3G", years: "2001+", usage: "Voix + data mobile", debit: "~2–42 Mbps (HSPA)", station: "NodeB", core: "Circuit + Paquet", note: "En cours d'extinction chez beaucoup d'opérateurs." },
  { gen: "4G / LTE", years: "2009+", usage: "Haut débit mobile (tout IP)", debit: "~50–300 Mbps", station: "eNodeB", core: "EPC (tout paquet)", note: "Le pilier actuel des réseaux mobiles." },
  { gen: "5G", years: "2019+", usage: "Très haut débit, faible latence, IoT massif", debit: "100 Mbps – plusieurs Gbps", station: "gNodeB", core: "5GC (cloud-native)", note: "Déploiement en cours, souvent au-dessus de la 4G." }
];

const FIVEG_FOCUS = [
  { t: "NSA vs SA", d: "NSA (Non-StandAlone) : la 5G s'appuie sur le cœur 4G (déploiement rapide). SA (StandAlone) : 5G de bout en bout avec le cœur 5GC (toutes les capacités, dont le slicing)." },
  { t: "gNodeB", d: "La station de base 5G. Souvent éclatée en CU (Centralized Unit) + DU (Distributed Unit) + RU (Radio Unit) — architecture 'split'." },
  { t: "Beamforming / Massive MIMO", d: "L'antenne concentre le signal en faisceaux dirigés vers l'utilisateur (au lieu d'arroser large) → plus de débit et de portée." },
  { t: "Network Slicing", d: "Découper le réseau en 'tranches' virtuelles dédiées (ex : une pour l'IoT, une pour la voix critique) avec des garanties propres." },
  { t: "Bandes de fréquences", d: "Sub-6 GHz (bonne couverture) et mmWave (26/28 GHz : débit énorme mais courte portée). Plus la fréquence est haute, plus le débit est grand mais la portée faible." },
  { t: "URLLC / eMBB / mMTC", d: "Les 3 usages 5G : URLLC (latence ultra-faible), eMBB (très haut débit), mMTC (connexion massive d'objets)." }
];

/* ============================================================
   Optimisation radio — leviers d'action
   ============================================================ */
const OPTIM = [
  { lever: "Tilt (inclinaison)", what: "Incliner l'antenne vers le bas (down-tilt) électriquement ou mécaniquement.", when: "Réduire une cellule trop étendue, limiter les interférences, mieux couvrir près du site.", risk: "Trop de tilt = trous de couverture en bordure." },
  { lever: "Azimut (orientation)", what: "Tourner l'antenne horizontalement.", when: "Réorienter la couverture vers une zone mal desservie ou à fort trafic.", risk: "Peut découvrir une autre zone." },
  { lever: "Puissance d'émission", what: "Augmenter/réduire la puissance de la cellule.", when: "Étendre la couverture ou réduire le chevauchement avec les voisines.", risk: "Trop de puissance = interférences et 'cell overshooting'." },
  { lever: "Seuils de handover", what: "Ajuster quand le mobile bascule vers une cellule voisine.", when: "Réduire les coupures (DCR) et les handovers ratés (HOSR faible).", risk: "Mauvais réglage = ping-pong entre cellules." },
  { lever: "Réutilisation de fréquences", what: "Planifier les fréquences pour éviter que des cellules voisines se gênent.", when: "Réduire les interférences (SINR faible).", risk: "Mauvais plan = chute de qualité." },
  { lever: "Ajout de capacité", what: "Activer une porteuse/fréquence supplémentaire, carrier aggregation, ou nouveau site.", when: "Saturation (PRB élevé) aux heures de pointe.", risk: "Coût ; nécessite des ressources/licences." },
  { lever: "Load balancing", what: "Répartir les utilisateurs vers les cellules/couches moins chargées.", when: "Une cellule sature alors que la voisine est libre.", risk: "Réglage fin requis." }
];

/* ============================================================
   Correspondance alarmes Huawei <-> Nokia
   ============================================================ */
const ALARM_MAPPING = [
  { type: "Cellule indisponible", huawei: "Cell Unavailable", nokia: "Cell Operation Degraded / Out of Use", sev: "critical" },
  { type: "Site déconnecté", huawei: "NE Is Disconnected", nokia: "Base Station Connectivity Lost", sev: "critical" },
  { type: "Lien de signalisation", huawei: "SCTP Link Fault / S1 Interface Fault", nokia: "S1 Signalling Link Failure", sev: "critical" },
  { type: "Panne de carte", huawei: "Board Hardware Fault", nokia: "Unit Faulty / Hardware Failure", sev: "critical" },
  { type: "Coupure secteur", huawei: "AC Mains Failure / Power Module Fault", nokia: "Mains Power Failure", sev: "critical" },
  { type: "Tête radio", huawei: "RRU Maintenance Link Failure", nokia: "Radio Module Faulty", sev: "major" },
  { type: "Antenne / câble", huawei: "VSWR Threshold Crossed", nokia: "Antenna Line VSWR Alarm", sev: "major" },
  { type: "Synchro horloge", huawei: "Clock Reference Problem / GPS Antenna Fault", nokia: "Synchronization Lost / GPS Failure", sev: "major" },
  { type: "Température", huawei: "Cabinet High Temperature", nokia: "High Temperature Alarm", sev: "major" },
  { type: "Lien CPRI (BBU-RRU)", huawei: "CPRI Interface Error", nokia: "Optical Interface Failure (RF)", sev: "major" },
  { type: "Licence", huawei: "License Expired", nokia: "License Expiry Warning", sev: "minor" }
];

/* ============================================================
   Commandes MML détaillées — syntaxe + exemple de sortie
   ============================================================ */
const MML_DETAILED = [
  {
    cmd: "DSP CELL: LocalCellId=0;",
    desc: "Affiche l'état dynamique de la cellule d'identifiant 0.",
    output: "Local Cell ID = 0\nCell Name = Dakar_Plateau_C1\nCell instance state = Normal\nCell available state = Cell available"
  },
  {
    cmd: "DSP ALMAF:;",
    desc: "Liste toutes les alarmes actives du NE.",
    output: "Alarm ID = 26529\nName = Cell Unavailable\nLevel = Critical\nOccurred = 2026-06-14 03:12:07\nLocation = Cell=2"
  },
  {
    cmd: "DSP BRD:;",
    desc: "Affiche l'état des cartes du site.",
    output: "Cabinet No.=0  Slot No.=6  Board Type=UMPT  Board Status=Normal\nCabinet No.=0  Slot No.=2  Board Type=LBBP  Board Status=Normal"
  },
  {
    cmd: "DSP RRU:;",
    desc: "Affiche l'état des têtes radio (RRU).",
    output: "Cabinet No.=60  RRU Type=...  Run Status=Normal  VSWR(0.1)=12"
  },
  {
    cmd: "DSP SCTPLNK:;",
    desc: "État des liens SCTP (signalisation vers le cœur).",
    output: "SCTP Link No.=0  Operation state=UP  ...  (DOWN si problème transmission)"
  },
  {
    cmd: "PING: SRN=0, SN=7, IPADDR=\"10.10.10.1\", CONT=4;",
    desc: "Teste la connectivité IP vers une adresse depuis une carte.",
    output: "Reply from 10.10.10.1: bytes=32 time=2ms  (Timeout si lien coupé)"
  },
  {
    cmd: "BLK CELL: LocalCellId=0;",
    desc: "⚠️ Bloque la cellule 0 (avant maintenance). Coupe le service.",
    output: "Result: Operation succeeded. Cell blocked."
  },
  {
    cmd: "UBL CELL: LocalCellId=0;",
    desc: "Débloque la cellule 0 et la remet en service.",
    output: "Result: Operation succeeded. Cell unblocked → available."
  }
];

/* ============================================================
   Préparation entretien — questions / réponses modèles
   ============================================================ */
const INTERVIEW = [
  {
    cat: "Méthode",
    q: "Comment diagnostiques-tu une cellule qui est tombée (down) ?",
    a: "Je pars de la méthode : (1) je vérifie les alarmes et identifie l'alarme racine, pas les enfants ; (2) je regarde la portée — tout le site ou une cellule ; (3) je classe la cause probable (transmission / énergie / matériel / config) via des commandes comme DSP CELL, DSP RRU, PING ; (4) je confirme avec les KPI (trafic/dispo avant-après) ; (5) j'agis ou j'escalade ; (6) je vérifie le retour à la normale avant de clôturer."
  },
  {
    cat: "KPI",
    q: "Quelle est la différence entre CSSR et DCR ?",
    a: "Le CSSR (Call Setup Success Rate) mesure l'accessibilité : la capacité à établir un appel (cible > 98 %). Le DCR (Drop Call Rate) mesure la rétention : le taux d'appels coupés une fois établis (cible < 2 %). L'un concerne le démarrage de l'appel, l'autre sa stabilité."
  },
  {
    cat: "KPI",
    q: "Un débit faible sans aucune alarme : comment l'expliques-tu ?",
    a: "Probablement de la saturation, pas une panne. Je vérifie le PRB Utilization : s'il est proche de 100 % aux heures de pointe, la cellule manque de capacité. La solution n'est pas un dépannage mais de l'optimisation : activer une porteuse, faire du load balancing, ou recommander un site."
  },
  {
    cat: "Alarmes",
    q: "Tu reçois 30 alarmes d'un coup. Par quoi commences-tu ?",
    a: "Je trie : d'abord la sévérité (Critical en premier), puis la portée (un site entier prime sur une cellule), puis l'impact client (zone dense > rurale). Surtout, je cherche l'alarme racine : une seule panne, comme une coupure de transmission, génère une cascade d'alarmes enfants. Je traite la cause, pas les symptômes."
  },
  {
    cat: "Alarmes",
    q: "Que fais-tu face à une alarme 'Mains Failure' (coupure secteur) ?",
    a: "C'est une urgence avec compte à rebours : le site est sur batterie. Je vérifie si c'est une coupure générale de la zone, j'estime l'autonomie batterie, et je fais mobiliser un groupe électrogène avant épuisement. L'objectif est d'éviter l'extinction du site."
  },
  {
    cat: "Technique",
    q: "Différence entre BBU et RRU ?",
    a: "La BBU (BaseBand Unit) est l'unité de traitement bande de base, le 'cerveau' du site, en bas. La RRU (Remote Radio Unit) est la tête radio déportée, près de l'antenne, qui émet/reçoit le signal. Elles sont reliées par une fibre (interface CPRI)."
  },
  {
    cat: "Technique",
    q: "Que t'indique une alarme VSWR ?",
    a: "Une désadaptation entre la radio et l'antenne : câble feeder endommagé, connecteur desserré ou infiltration d'eau. Ça dégrade la couverture et la radio peut réduire sa puissance pour se protéger. La résolution passe par une intervention terrain sur l'antenne/le feeder."
  },
  {
    cat: "Optimisation",
    q: "Comment réduire un taux de coupure (DCR) élevé sur une cellule ?",
    a: "J'analyse d'abord la cause : interférences (SINR faible), couverture insuffisante (RSRP faible) ou mauvais handover. Selon le cas, j'ajuste les seuils de handover, le tilt/la puissance, ou le plan de fréquences. Je valide ensuite avec les KPI et, si besoin, un drive test."
  },
  {
    cat: "Profil",
    q: "Pourquoi un profil BI est-il pertinent pour ce poste ?",
    a: "Le métier repose sur l'analyse de données : les KPI, les compteurs, les logs. Je sais extraire (SQL), automatiser (Python), et construire des dashboards (Power BI) — exactement ce qu'on fait pour suivre la performance réseau et détecter les anomalies. Il me reste à monter en compétence sur le vocabulaire et les outils télécom, ce que je fais activement."
  },
  {
    cat: "Profil",
    q: "Quelle différence entre NetAct et U2020 ?",
    a: "Ce sont deux OSS (plateformes de supervision) : NetAct est celui de Nokia, U2020 celui de Huawei. Le concept est identique — alarmes, KPI, configuration — mais NetAct est plutôt graphique (CM Editor) tandis qu'U2020 utilise beaucoup les commandes MML en texte. Huawei est très présent en Afrique et en Asie."
  }
];

/* ============================================================
   Simulateur NOC — alarmes à trier par priorité
   weight élevé = à traiter en premier (priorité haute)
   ============================================================ */
const SIM_ALARMS = [
  { name: "Site entier Unavailable", sev: "critical", weight: 100 },
  { name: "Transmission Link Failure (plusieurs sites)", sev: "critical", weight: 95 },
  { name: "Power / Mains Failure (batterie faible)", sev: "critical", weight: 90 },
  { name: "S1 / SCTP Link Failure (un site)", sev: "critical", weight: 85 },
  { name: "Board / Card Fault", sev: "critical", weight: 80 },
  { name: "RRU Fault (un secteur down)", sev: "major", weight: 70 },
  { name: "VSWR Alarm (Major)", sev: "major", weight: 60 },
  { name: "Clock / GPS Sync Lost", sev: "major", weight: 55 },
  { name: "High Temperature", sev: "major", weight: 50 },
  { name: "Battery Fault (secteur OK)", sev: "major", weight: 45 },
  { name: "Cell Congestion (heure de pointe)", sev: "minor", weight: 30 },
  { name: "License Expiry Warning", sev: "minor", weight: 20 },
  { name: "Door / External Alarm", sev: "minor", weight: 15 }
];

/* ============================================================
   Ressources d'apprentissage (liens externes)
   ============================================================ */
const RESOURCES = [
  { cat: "Huawei", title: "Huawei Talent Online (iLearningX)", url: "https://e.huawei.com/en/talent/", desc: "Cours et certifications gratuits, dont HCIA-5G. Le meilleur point d'entrée." },
  { cat: "Nokia", title: "Nokia — Learning & 5G", url: "https://www.nokia.com/", desc: "Formations Nokia et certifications Bell Labs 5G." },
  { cat: "BI / Data", title: "Microsoft Learn — PL-300 (Power BI)", url: "https://learn.microsoft.com/credentials/certifications/power-bi-data-analyst-associate/", desc: "Certification Power BI Data Analyst — valorise ton profil BI." },
  { cat: "Standards", title: "3GPP — spécifications mobiles", url: "https://www.3gpp.org/", desc: "L'organisme qui définit les normes 2G→5G. Référence technique." },
  { cat: "Planification", title: "Forsk — Atoll", url: "https://www.forsk.com/atoll-overview", desc: "L'outil de planification radio le plus répandu." },
  { cat: "Data", title: "Python — pandas", url: "https://pandas.pydata.org/docs/", desc: "Pour automatiser l'analyse des KPI et logs réseau." }
];

/* ============================================================
   Seuils Drive Test par technologie (valeurs INDICATIVES)
   Les seuils exacts dépendent de l'opérateur / du régulateur
   (ex. ARTP Décision 2021-002).
   ============================================================ */
const DT_SERVICE = [
  { gen: "2G", cls: "gen-2g", cssr: "≥ 98 %", dcr: "≤ 2 %", setup: "< 15 s", mos: "≥ 3,0", dl: "0,1 – 0,3 Mbps (GPRS/EDGE)" },
  { gen: "3G", cls: "gen-3g", cssr: "≥ 98 %", dcr: "≤ 2 %", setup: "< 15 s", mos: "≥ 3,5", dl: "2 – 42 Mbps (HSPA)" },
  { gen: "4G", cls: "gen-4g", cssr: "≥ 98 % (VoLTE)", dcr: "≤ 2 %", setup: "< 15 s", mos: "≥ 3,8", dl: "≥ 10 Mbps (jusqu'à 100+)" },
  { gen: "5G", cls: "gen-5g", cssr: "≥ 98 % (VoNR/VoLTE)", dcr: "≤ 1–2 %", setup: "< 15 s", mos: "≥ 4,0", dl: "≥ 100 Mbps (jusqu'au Gbps)" }
];

const DT_RADIO = [
  { gen: "2G", cls: "gen-2g", covName: "RxLevel", covGood: "≥ -85 dBm", covBad: "< -100 dBm", qualName: "RxQual (0–7)", qualGood: "0 – 3", qualBad: "6 – 7" },
  { gen: "3G", cls: "gen-3g", covName: "RSCP", covGood: "≥ -85 dBm", covBad: "< -100 dBm", qualName: "Ec/No", qualGood: "≥ -9 dB", qualBad: "< -13 dB" },
  { gen: "4G", cls: "gen-4g", covName: "RSRP", covGood: "≥ -95 dBm", covBad: "< -115 dBm", qualName: "RSRQ / SINR", qualGood: "RSRQ ≥ -10 dB · SINR ≥ 13 dB", qualBad: "RSRQ < -16 · SINR < 0" },
  { gen: "5G", cls: "gen-5g", covName: "SS-RSRP", covGood: "≥ -95 dBm", covBad: "< -115 dBm", qualName: "SS-RSRQ / SS-SINR", qualGood: "SS-SINR ≥ 13 dB", qualBad: "SS-SINR < 0 dB" }
];

/* ============================================================
   Comparatif opérateurs Sénégal
   Marché : données ARTP T3 2024 (parts de marché abonnés, trafic voix).
   QoS : campagne ARTP nov 2024 - mars 2025 (conformité par service).
   ============================================================ */
const OP_MARKET = [
  { op: "Orange (Sonatel)", share: "57,12 %", traffic: "75,87 %", color: "#ff7900" },
  { op: "Yas (ex-Free)", share: "22,26 %", traffic: "16,95 %", color: "#e2001a" },
  { op: "Expresso", share: "16,36 %", traffic: "4,34 %", color: "#00a0e3" },
  { op: "Autres (Pro Mobile, Hayo)", share: "4,26 %", traffic: "—", color: "#78909c" }
];

const OP_QOS = [
  { op: "Orange (Sonatel)", reussite: "ok", delai: "ko", mos: "ok", sms: "ko", data: "ok" },
  { op: "Yas (ex-Free)", reussite: "ok", delai: "ko", mos: "ok", sms: "ko", data: "ko" },
  { op: "Expresso", reussite: "ok", delai: "ko", mos: "ok", sms: "ko", data: "ko" }
];

/* ============================================================
   Marché télécom Sénégal — chiffres clés (ARTP, T3 2024)
   ============================================================ */
const KEY_FIGURES = [
  { label: "Abonnés mobiles", value: "23,26 M", sub: "+1,06 % vs T2 2024" },
  { label: "Pénétration mobile", value: "128,3 %", sub: "plusieurs SIM / personne" },
  { label: "Abonnés Internet", value: "21,32 M", sub: "+2,52 %" },
  { label: "Abonnés Internet mobile", value: "20,63 M", sub: "la quasi-totalité" },
  { label: "Pénétration Internet mobile", value: "113,8 %", sub: "+1,89 pt" },
  { label: "Couverture 3G/4G/5G", value: "96,82 %", sub: "pénétration Internet mobile haut débit" },
  { label: "Trafic voix mobile", value: "10,23 Mds min", sub: "Orange 75,9 % · Yas 17,0 % · Expresso 4,3 %" }
];
