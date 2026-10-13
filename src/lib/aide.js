// ============================================================
//  Explications des ⓘ de l'admin (components/InfoTip.jsx).
//
//  PAGES  : une explication par page, affichée à côté du titre de la page
//           (components/PageHeader.jsx la trouve d'après l'adresse).
//  TITRES : une explication par titre de section, de carte ou d'indicateur,
//           cherchée d'après le texte exact du titre.
//
//  Textes courts (1 à 3 phrases) : ce que montre la partie, d'où vient le
//  chiffre, ce qu'on peut y faire. Un titre absent d'ici n'a pas de ⓘ.
// ============================================================

export const PAGES = {
  '/': "Vue d'ensemble de l'activité : ce qui demande une action, les opérations en direct, les chiffres du jour, les comptes et les tendances. Les cartes s'ouvrent sur leur détail.",
  '/map': 'Carte en temps réel des coursiers en ligne et des courses en cours. Les positions se mettent à jour toutes seules.',
  '/orders': "Toutes les courses, avec leur statut, le client, le coursier et le trajet. Un clic ouvre la fiche : chronologie, montants, paiement et actions (relancer, annuler, marquer payé selon votre rôle).",
  '/incidents': "Incidents détectés automatiquement (coursier injoignable, course abandonnée, SOS) ou signalés par l'équipe. « À traiter » regroupe les nouveaux et ceux en cours ; la fiche permet de suivre et de clore.",
  '/validation': "Inscriptions et demandes en attente de décision : chefs de flotte, coursiers, pièces à revoir, comptes DEM Pro, extensions de flotte et demandes internes. Le nombre sur chaque onglet est le nombre en attente.",
  '/service-client': "Espace de travail du Service Client : vue d'ensemble du support, gestes commerciaux et suivi de vos demandes envoyées au Super Admin.",
  '/clients': "Comptes clients. Les vues (Actifs, Inactifs, Bannis, Supprimés) et les filtres s'appliquent à tous les clients. Un clic ouvre la fiche : informations, wallet, commandes et actions.",
  '/drivers': "Comptes coursiers, en flotte ou indépendants. Un clic ouvre la fiche : informations, pièces, paiements et actions (valider, suspendre, signaler…) selon votre rôle.",
  '/dem-pro': "Comptes commerçants DEM Pro, leurs offres (Starter, Business, Premium) et le parrainage entre commerçants. Un clic ouvre la fiche avec ses onglets et la barre d'actions.",
  '/chefs-de-flotte': 'Chefs de flotte et taille de leur flotte. Un clic ouvre la fiche : informations, pièces, statistiques et coursiers gérés.',
  '/chefs-de-flotte/': "Fiche d'un chef de flotte : ses informations et pièces, les statistiques de sa flotte et ses coursiers. Les actions disponibles dépendent de votre rôle.",
  '/codes-acces': "Pour un numéro de téléphone : où en sont ses codes SMS (quota du jour, délai d'attente) et la sécurité du compte (code secret, gel, appareils). Débloquer et dégeler se confirment ici.",
  '/finance': "Argent réel de DEM : revenus facturés et encaissés, commission à recouvrer, paiements et pass coursiers. Les cartes du haut portent sur aujourd'hui, sauf le cumul à recouvrer.",
  '/tarifs': "Prix des courses (promo, frais de mise en relation, grille des zones, tarif hors zone), pass coursiers, réglages DEM Pro, heures de pointe, zone de livraison et réglage technique. Chaque bloc s'enregistre séparément.",
  '/marketing': "Acquisition, rétention, comportement des courses et campagnes promo. Les cartes du haut s'ouvrent sur leur détail.",
  '/recompenses': "Rien n'est offert automatiquement : vous attribuez une récompense à une personne, ou vous activez une règle avec ses dates. L'historique montre tout ce qui a été attribué, utilisé ou annulé.",
  '/parrainage': "Parrainages entre clients : qui a parrainé qui. Un parrain avec beaucoup de filleuls est signalé « À vérifier ». Les parrainages DEM Pro sont dans DEM Pro › Parrainage.",
  '/badges': 'Paliers de badges des clients et des coursiers, leurs seuils et les badges clients à valider.',
  '/notifications': "Notifications push envoyées tout de suite ou programmées, historique des envois et alerte affichée dans l'application.",
  '/relances': 'Nouveaux inscrits à contacter et journal des appels de prospection et de support.',
  '/equipes': "Comptes de l'équipe admin et leurs rôles. Le rôle décide des pages et des actions accessibles. Les demandes de réinitialisation de mot de passe arrivent ici.",
  '/audit': "Journal de toutes les actions faites par les admins (qui, quoi, sur quoi, quand). Un clic sur une ligne ouvre son détail.",
  '/maintenance': "Tâches ponctuelles sur les données (aperçu puis exécution), fournisseur des SMS et activation du code secret. Chaque exécution est tracée dans l'audit.",
  '/version-app': "Version minimale de l'application et invitation à mettre à jour, pour Android et iPhone.",
}

// Explication d'une page d'après l'adresse (fiche d'un chef de flotte comprise).
export function pageHelp(pathname) {
  if (PAGES[pathname]) return PAGES[pathname]
  if (pathname.startsWith('/chefs-de-flotte/')) return PAGES['/chefs-de-flotte/']
  return null
}

export const TITRES = {
  // ── Dashboard ──
  'À traiter': "Ce qui demande une action maintenant : alertes financières, courses sans coursier depuis trop longtemps, incidents ouverts, validations en attente. Un clic mène à la page concernée.",
  'En direct': "État des opérations à cet instant : courses en attente d'un coursier, courses en cours, coursiers en ligne.",
  "Aujourd'hui": "Chiffres depuis minuit, comparés à hier à la même heure (flèche verte ou rouge).",
  'Comptes': "Clients et DEM Pro inscrits, comptes ayant commandé dans les 24 dernières heures et notes basses.",
  'Tendances': "Évolution sur la période choisie : courses créées et livrées, taux d'annulation et revenus par jour.",
  "En attente d'un coursier": "Courses créées pour lesquelles aucun coursier n'a encore accepté.",
  'Courses en cours': "Courses acceptées par un coursier et pas encore livrées.",
  'Coursiers en ligne': 'Coursiers connectés et disponibles en ce moment (libres ou en course).',
  'Courses créées aujourd’hui': "Courses créées depuis minuit, quel que soit leur statut. La barre montre leur répartition (programmées, en attente, en cours, livrées, annulées).",
  'Commission DEM facturée': "Commission DEM sur les courses livrées (date de livraison), qu'elle soit encaissée ou à recouvrer.",
  'Gains coursiers': 'Part des coursiers sur les courses livrées (date de livraison).',
  "Taux d'annulation": "Part des courses créées aujourd'hui qui ont été annulées. Sur peu de courses, le pourcentage est peu parlant (affiché en gris).",
  'Nouveaux clients': 'Comptes clients créés sur la période affichée.',
  'Pass achetés': "Pass coursiers achetés aujourd'hui (les pass offerts sont comptés à part).",
  'Clients inscrits': 'Tous les comptes clients non supprimés.',
  'DEM Pro actifs / comptes': 'Comptes DEM Pro validés et non suspendus, sur le total des comptes DEM Pro.',
  'Comptes ayant commandé (24 h)': 'Clients et commerçants DEM Pro qui ont créé au moins une commande dans les 24 dernières heures, avec le nombre de commandes.',
  'Notes inférieures à 3/5': 'Coursiers dont la note moyenne est sous 3/5, et clients qui donnent en moyenne des notes sous 3/5.',
  "Fil d'activité": 'Derniers événements de la plateforme (courses, inscriptions, paiements), du plus récent au plus ancien.',
  "Taux d'annulation — 30 derniers jours": "Part des courses créées chaque jour qui ont été annulées.",
  'Courses créées et livrées': 'Par jour : courses créées et courses livrées.',

  // ── Fiche d'une course ──
  'Chronologie': 'Les étapes de la course avec leur heure et le temps passé entre deux étapes.',
  'Trajet': 'Adresses de départ et d’arrivée ; un clic ouvre le point dans Google Maps.',
  'Personnes': 'Client, coursier et destinataire, avec appel et WhatsApp en un clic.',
  'Montants': "Ce que paie le client, la part du coursier et la commission DEM.",
  'Montants prévus': "Montants qui auraient été dus si la course n'avait pas été annulée.",
  'Paiement': 'Moyen de paiement et statut (payé, en attente, en litige).',
  'Note du client': 'Note et commentaire laissés par le client après la livraison.',
  'Preuve de livraison': 'Photo prise par le coursier à la livraison.',

  // ── Incidents ──
  "Ce qui s'est passé": "Type d'incident, gravité, heure de détection et détails envoyés par le système.",
  'Course liée': 'La course concernée par l’incident, avec un lien vers sa fiche.',
  'Suivi': "Statut de l'incident et notes de l'équipe. Clore l'incident le passe en résolu.",
  'Coursier': 'Le coursier concerné, avec son téléphone.',
  'Utilisateur signalé': "La personne signalée par l'équipe et le motif du signalement.",

  // ── Fiches client / coursier ──
  'Informations': 'Données du compte : contact, dates, vérification.',
  'Wallet': "Solde du wallet, dont la part retirable (remboursements), et derniers mouvements.",
  'Commandes récentes': 'Dernières commandes du compte. Les totaux portent sur tout l’historique.',
  'Contact': 'Appeler ou écrire sur WhatsApp en un clic.',
  'Actions': 'Actions possibles sur ce compte selon votre rôle. Les actions sensibles se confirment ici avant d’être envoyées.',
  'Flotte': 'Chef de flotte qui gère ce coursier, ou « Indépendant ».',
  'Pièces': 'Documents envoyés (permis, carte grise, assurance, CNI…). Un clic agrandit la pièce.',
  'Statistiques de paiement': 'Courses payées, montant gagné, paiements en attente et litiges du coursier.',

  // ── DEM Pro ──
  'Activité sur la période': 'Commandes, livraisons, annulations, montants et commission DEM du commerçant sur la période choisie.',
  'En ce moment': 'Commandes programmées, en attente, en cours, livrées non réglées et paiements en litige.',
  'Situation actuelle': "Offre en cours, statut de l'abonnement et date de fin.",
  "Achats d'abonnement": "Achats d'offre du commerçant et leur issue réelle (payé, abandonné, échoué…).",
  'Changements de plan par un admin': "Changements d'offre faits à la main depuis l'admin.",
  'Soldes': 'Solde du wallet commerçant et part retirable.',
  'Ventes en paiement intégré': 'Ventes payées dans l’app par les clients du commerçant.',
  'Retraits': 'Retraits demandés par le commerçant et leur statut.',
  'Journal du wallet': 'Tous les mouvements du wallet commerçant.',
  'Boutique en ligne': 'Catalogue de produits de la boutique du commerçant.',
  'Points de vente': 'Adresses de retrait du commerçant.',
  'Membres': "Personnes de l'équipe du commerçant, avec leur propre numéro et leur rôle.",
  'Téléphones connectés': 'Appareils connectés au compte, dans la limite de son offre.',
  'Préparation de la bascule': 'Points à vérifier avant de passer au système de paliers Starter / Business / Premium.',
  'Répartition des comptes DEM Pro': "Nombre de comptes par offre. Payé = abonnement réglé et en cours ; manuel = attribué par un admin sans paiement.",
  "Achats d'abonnement récents": "Derniers achats d'offre et revenus des abonnements sur 30 jours.",
  'Paliers DEM Pro (Starter / Business / Premium)': 'Prix, limites et activation des offres DEM Pro.',

  // ── Codes et accès ──
  'Codes SMS': "Codes envoyés à ce numéro sur 24 h par motif, délai avant le prochain code et code en attente. Au-delà du quota du jour, le numéro est bloqué jusqu'au déblocage.",
  'Sécurité du compte': "Code secret, codes faux d'affilée, gel « ce n'était pas moi », retraits bloqués, appareils connectés et derniers événements de sécurité.",

  // ── Finance ──
  'Revenus DEM facturés (jour)': "Revenus DEM d'aujourd'hui : commission sur les courses livrées, pass, abonnements et commission sur les ventes DEM Pro. « Encaissés » = argent déjà chez DEM.",
  'Commission courses (jour)': "Commission DEM des courses livrées aujourd'hui : en ligne = déjà chez DEM ; à recouvrer = payée en espèces au coursier ou pas encore payée.",
  'Commission à recouvrer (cumul)': "Commission DEM restée chez les coursiers (courses payées en espèces) ou pas encore payée, depuis le début.",
  'Livraisons payées (jour)': "Courses livrées aujourd'hui dont le paiement est enregistré, sur le nombre de courses livrées.",
  'Pass achetés (jour)': "Pass coursiers achetés aujourd'hui, plus ceux offerts.",
  'Détail par période': "Toutes les sources de revenus DEM par période, puis les courses livrées. « 30 jours » = aujourd'hui et les 29 jours précédents.",
  'Frais de mise en relation depuis le lancement': 'Frais DEM facturés et encaissés sur toutes les courses livrées depuis le lancement, et frais moyen réel par course.',
  'Dû par les coursiers': 'Montants de pass dus par les coursiers et prélèvement manuel (Super Admin).',
  'Pass achetés et offerts — 30 derniers jours': 'Par jour : pass achetés et pass offerts.',
  'Coursiers — passe valide en ce moment': "Coursiers qui ont un pass encore valide aujourd'hui.",
  'Santé du solde partenaire': 'Solde du compte SamirPay de DEM, utilisé pour payer les retraits et remboursements.',
  'Collecté par opérateur': 'Montants encaissés en ligne, par opérateur (Wave, Orange Money…).',
  'Lien de commande DEM Pro — commandes payées (30 jours)': 'Commandes passées par le lien de commande DEM Pro et payées en ligne sur 30 jours.',
  'Paiements à rembourser': 'Paiements en ligne reçus sans course aboutie (ou en double) : à rembourser au client.',
  'Lien de commande DEM Pro — remboursements automatiques': "Remboursements lancés automatiquement pour les commandes du lien DEM Pro non livrées ; ceux en échec ou à vérifier sont à traiter.",
  'Retraits en vérification manuelle': "Retraits bloqués par une règle de sécurité, à vérifier avant de les clore.",
  'Transactions orphelines': "Paiements reçus par l'opérateur qu'on n'arrive pas à rattacher à une recharge ou à une commande.",
  'Export rapprochement comptable': 'Fichier des transactions pour rapprocher les paiements avec les relevés des opérateurs.',

  // ── Tarifs et zones ──
  'Promotion prix unique': "Quand elle est active, chaque course coûte le même prix au client, quelle que soit la distance. La grille des zones n'est pas modifiée.",
  'Frais de mise en relation': 'Montant pris sur chaque course, sur la part du coursier. Le prix client ne change pas. Ne touche que les nouvelles courses.',
  'Matrice tarifaire zone-à-zone (Dakar)': "Prix d'une course entre deux zones de Dakar, dans les deux sens. C'est le tarif principal.",
  'Zones (Dakar)': 'Zones de Dakar et de sa banlieue utilisées par la grille.',
  'Zones (Dakar) — interrupteurs': 'Activent la grille des zones et le calcul de distance par itinéraire réel.',
  'Tarif hors zone': 'Tarif de base et prix au kilomètre, utilisés seulement hors des zones de la grille. La simulation montre une course de 5 km.',
  'Pass coursiers': "Pass que les coursiers achètent pour travailler, leur prix et le blocage de la mise en ligne sans pass.",
  'Paiement intégré DEM Pro': 'Commission DEM prélevée sur la part « produit » des commandes payées dans l’app par les clients DEM Pro.',
  'Ancien système DEM Pro (gelé)': "Prix mensuels de l'ancien système Pro / Business, gardés pour mémoire. Les offres actuelles se règlent dans DEM Pro › Offres.",
  'Majoration aux heures de pointe': 'Multiplie le prix total des courses pendant les tranches horaires choisies, quand elle est activée.',
  'Zone de livraison': "Cercle accepté par la boutique publique DEM Pro : une adresse hors du cercle est refusée.",
  'Suivi du coursier en course': "Rythme d'envoi de la position du coursier pendant une course. Plus court = suivi plus fluide pour le client.",

  // ── Marketing ──
  'Nouveaux clients (jour)': "Comptes clients créés aujourd'hui.",
  'Rétention 30 jours': 'Part des clients servis sur les 30 jours précédents qui ont recommandé sur les 30 derniers jours.',
  'Taux annulation (jour)': "Part des courses créées aujourd'hui qui ont été annulées.",
  'Courses livrées (jour)': "Courses livrées aujourd'hui.",
  'Clients actifs': 'Clients servis au moins une fois sur les 30 derniers jours.',
  'Clients inactifs': 'Clients déjà servis, mais pas depuis 30 jours.',
  'Nouveaux coursiers': 'Comptes coursiers créés sur la période.',
  'Nouveaux DEM Pro': 'Comptes DEM Pro créés sur la période.',
  'Nouveaux chefs de flotte': 'Comptes chefs de flotte créés sur la période.',
  'Courbe de croissance — 30 derniers jours': 'Inscriptions par jour et par type de compte.',
  "Source d'inscription (clients, depuis le lancement)": 'Comment les clients disent avoir connu DEM.',
  "Taux d'annulation — évolution (30 derniers jours)": "Part des courses annulées, jour par jour.",
  "Motifs d'annulation (30 j)": "Raisons choisies à l'annulation, sur 30 jours.",
  'Comptes clients — activité': "Comptes clients répartis entre actifs (servis sur la période), inactifs (déjà servis, plus depuis) et jamais servis.",
  'Revenus DEM — 30 derniers jours': 'Par jour : revenus DEM facturés, encaissés, et commission restée à recouvrer.',
  'Commission sur les courses — 30 derniers jours': 'Par jour : commission encaissée en ligne (vert) et à recouvrer (orange). La hauteur totale = commission facturée du jour.',
  'Clients perdus — 30 derniers jours vs précédents': 'Clients servis sur la période précédente qui ne sont pas revenus.',
  'Offre de lancement : 100 premiers clients': 'Course offerte aux premiers clients inscrits (Super Admin).',

  // ── Parrainage ──
  'Total parrainages': 'Nombre de filleuls inscrits avec un code de parrainage client.',
  'Parrains (au moins 1 filleul)': 'Clients dont le code a servi au moins une fois.',
  'Bonus promis (non versés)': "Bonus enregistrés pour les parrainages. Aucun crédit n'est versé automatiquement dans l'app.",

  // ── Badges ──
  'À valider': 'Clients qui ont atteint un nouveau badge et attendent la validation du Super Admin.',

  // ── Poste Service Client ──
  'Rechercher un client': 'Retrouver un client par nom ou téléphone et voir ses informations.',
  'Incidents ouverts': 'Incidents nouveaux ou en cours, à suivre par le support.',
  'Paiements en attente': 'Courses livrées dont le paiement n’est pas encore enregistré.',
  'Nouvelle demande de geste commercial': 'Proposer une course gratuite ou une remise pour un client ; le Super Admin décide.',
  'Historique': 'Demandes déjà envoyées et leur décision.',
  'Nouveau client': "Comptes clients créés aujourd'hui.",
  'Courses': "Courses du jour pour le support : créées, livrées et annulées.",
  'Coursiers actifs': 'Coursiers validés et non suspendus.',
  'Coursiers notés < 3/5': 'Coursiers dont la note moyenne est inférieure à 3/5.',
  'Clients insatisfaits (note donnée < 3/5)': 'Clients qui donnent en moyenne des notes inférieures à 3/5.',
  'DEM Pro actifs / total': 'Comptes DEM Pro validés et non suspendus, sur le total.',

  // ── Fiche chef de flotte ──
  'Pièces du chef de flotte': 'CNI recto, verso et RCCM envoyés par le chef de flotte. Un clic agrandit la pièce.',
  'Statistiques de la flotte': 'Coursiers de la flotte, actifs et en attente, courses livrées et note moyenne.',
  'Coursiers gérés': 'Coursiers rattachés à ce chef de flotte, avec leurs pièces et les actions possibles selon votre rôle.',

  // ── Équipes ──
  'Demandes de réinitialisation de mot de passe': "Admins qui ont demandé un nouveau mot de passe depuis l'écran de connexion. Réinitialiser génère un mot de passe provisoire affiché une seule fois.",

  // ── Maintenance ──
  'Envoi des SMS (codes de connexion et de retrait)': "Fournisseur principal des SMS. S'il échoue, le même code part par l'autre fournisseur (secours automatique).",
  'Code secret : activation': 'Rôles pour lesquels la connexion par code secret est activée, et numéros pilotes.',
  "Version de l'app": "Dernière version proposée (invitation refermable) et version minimale (mise à jour obligatoire), par plateforme.",
}

// Onglets : une explication par onglet, par page (même libellé possible sur
// deux pages avec un sens différent). Affichée par components/TabBar.jsx à
// côté de la barre, pour l'onglet ouvert.
export const ONGLETS = {
  '/validation': {
    ambassadors:        'Chefs de flotte inscrits : vérifier leurs pièces puis valider ou refuser. Les chefs actifs peuvent être suspendus (Super Admin).',
    drivers:            "Coursiers inscrits qui attendent d'être activés. Impossible tant que leur chef de flotte n'est pas validé ou que l'assurance est expirée.",
    'kyc-review':       'Coursiers déjà inscrits dont une ou plusieurs pièces sont à vérifier ou à compléter. Une pièce peut être rejetée avec un motif.',
    'dem-pro':          'Comptes commerçants DEM Pro qui attendent une validation.',
    fleet:              "Demandes des chefs de flotte pour agrandir leur flotte (Super Admin).",
    'service-requests': 'Demandes envoyées par le Service Client (comptes DEM Pro, gestes commerciaux, suspensions) ; décision du Super Admin.',
    'finance-requests': 'Demandes de changement de tarif envoyées par la Finance ; décision du Super Admin.',
  },
  '/finance': {
    revenue:        "Revenus DEM par période et par source, graphique des 30 jours et frais depuis le lancement.",
    paiements:      'Encaissements des courses, impayés et litiges, et paiements en ligne (remboursements, retraits).',
    pass:           'Pass coursiers achetés et offerts, coursiers avec un pass valide, et dû par les coursiers.',
    encaissements:  'Répartition des courses payées par mode de paiement sur la période choisie, avec export.',
    impayes:        'Courses livrées non payées ou en litige, à résoudre une par une.',
    'en-ligne':     'Paiements en ligne SamirPay : solde partenaire, collecte par opérateur, remboursements, retraits à vérifier et rapprochement comptable.',
  },
  '/tarifs': {
    tarifs:    'Promotion prix unique, frais de mise en relation, grille des zones de Dakar et tarif hors zone.',
    pass:      'Pass coursiers : prix, activation et blocage de la mise en ligne sans pass.',
    dempro:    'Commission sur le paiement intégré DEM Pro. Les offres se règlent dans DEM Pro › Offres.',
    surge:     'Majoration du prix des courses pendant les heures de forte demande.',
    zone:      'Zone acceptée par la boutique publique DEM Pro.',
    technique: "Rythme d'envoi de la position du coursier pendant une course.",
  },
  '/marketing': {
    acquisition: "Inscriptions par type de compte et par période, courbe de croissance et source d'inscription.",
    retention:   'Clients qui reviennent, clients perdus et activité des comptes.',
    courses:     "Évolution des annulations et leurs motifs.",
    promotions:  'Campagnes de codes promo : création, activation, suppression. DEM finance la réduction, jamais le coursier.',
  },
  '/recompenses': {
    grant:   'Attribuer une récompense à une personne (client, coursier, DEM Pro), tout de suite ou à une date choisie.',
    history: 'Toutes les récompenses attribuées, utilisées ou annulées. Une récompense pas encore utilisée peut être annulée.',
    rules:   "Offres automatiques, éteintes par défaut : elles ne s'appliquent que si vous les activez, entre les dates choisies.",
  },
  '/badges': {
    clients:   'Badges des clients selon leurs courses ; un nouveau badge client est validé par le Super Admin.',
    coursiers: 'Badges des coursiers selon leurs courses, parrainages et note. Seuils modifiables par le Super Admin.',
  },
  '/notifications': {
    envoyer:    "Envoyer une notification push maintenant ou la programmer, par type de compte. Un test sur un numéro est possible avant l'envoi.",
    historique: 'Notifications déjà envoyées, avec leur cible et leurs résultats.',
    alerte:     "Message affiché en haut de l'application tant qu'il est actif.",
  },
  '/relances': {
    inscrits: 'Nouveaux inscrits par type de compte et par période, à contacter.',
    appels:   "Journal des appels : à qui on a parlé, le résultat et les notes. Chaque ligne s'enregistre en direct.",
  },
  '/maintenance': {
    taches: "Corrections ponctuelles exécutées sur le serveur : un aperçu qui n'écrit rien, puis l'exécution après confirmation.",
    sms:    'Choix du fournisseur principal des SMS de codes, secours automatique et suivi des envois.',
    code:   'Activation de la connexion par code secret, par rôle, et numéros pilotes.',
  },
  '/dem-pro': {
    comptes:    'Comptes commerçants : vues par statut, plan, offre groupée et fiche de chaque compte.',
    offres:     'Offres Starter / Business / Premium : prix, limites, interrupteur et suivi des abonnements.',
    parrainage: 'Parrainages entre commerçants DEM Pro et jours offerts en récompense (Super Admin).',
  },
  '/service-client': {
    overview: "Vue du support : recherche d'un client, commandes récentes, incidents ouverts et paiements en attente.",
    gestes:   'Demander une course gratuite ou une remise pour un client ; le Super Admin décide.',
    requests: 'Vos demandes envoyées au Super Admin et leur décision.',
  },
}

export function tabHelp(pathname, key) {
  return ONGLETS[pathname]?.[key] ?? null
}

export function helpFor(key) {
  if (typeof key !== 'string') return null
  return TITRES[key] ?? null
}
