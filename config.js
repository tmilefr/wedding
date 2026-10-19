// Tout le contenu du site est ici : modifiez ce fichier, relancez le serveur, c'est tout.

module.exports = {
  couple: { first: 'Isabel', second: 'Arnaud' }, // À REMPLACER
  dateLabel: 'samedi 27 août 2027',
  dateShort: '27/08/2027',
  intro:
    "Pour préparer au mieux cette fête que nous voulons à notre image, conviviale et participative, nous avons besoin de vous.",

  venue: {
    name: 'la maison de Baeselbach',
    address: 'Chemin de Baeselbach, 68290 Bourbach-le-Haut',
  },

  lodging:
    "Un logement sur place est prévu. Pensez à apporter un drap housse, un sac de couchage et une taie d'oreiller. Les lits sont des lits une place, et ils ne se déplacent pas.",

  program: [
    {
      day: 'Vendredi',
      note: "La salle est à nous dès 14h pour préparer et commencer la fête.",
      items: [
        { time: '14h', title: 'Préparation de la salle', place: 'Maison de Baeselbach' },
        { time: 'Soir', title: 'Repas partagé', place: 'Maison de Baeselbach' },
      ],
    },
    {
      day: 'Samedi 27 août',
      items: [
        {
          time: '11h',
          title: 'Mairie',
          place: "Hôtel de ville, 2 place de la Réunion, Mulhouse",
        },
        { time: 'Midi', title: 'Déjeuner libre', place: 'Le temps de visiter Mulhouse' },
        {
          time: '15h',
          // ⚠ À VÉRIFIER : le Word indiquait l'église Saint-Dominique de Vieux-Thann,
          // le formulaire de test la collégiale Saint-Thiébaut de Thann. Gardez la bonne.
          title: 'Église',
          place: 'Collégiale Saint-Thiébaut, 10 place Joffre, Thann',
        },
        {
          time: '17h30',
          title: "Vin d'honneur puis soirée",
          place: 'Maison de Baeselbach',
        },
      ],
      note: "Musiciens, venez avec vos instruments. Danseurs, soyez prêts !",
    },
    {
      day: 'Dimanche et lundi',
      note: "Rangement de la salle et brunch le dimanche. Nous pouvons prolonger la fête jusqu'au lundi midi selon les envies de chacun.",
      items: [
        { time: 'Dimanche', title: 'Brunch et rangement', place: 'Maison de Baeselbach' },
        { time: 'Lundi midi', title: 'Fin des festivités (en option)', place: 'Maison de Baeselbach' },
      ],
    },
  ],

  // Idées affichées sous la question « spécialité régionale ». Un clic les ajoute à la réponse.
  specialtyIdeas: [
    'Tourtons, tartes du Champsaur, tomme des Alpes',
    'Cannelés',
    'Gâteaux basques, tomme de brebis, confiture de cerises noires',
    'Chocolat belge, gaufres de Liège, spéculoos, bière',
    'Jambon, parmesan, pêches',
    'Navettes de Marseille',
    'Pâtés lorrains, mirabelles',
    'Spécialités tchèques',
    'Empanadas et spécialités argentines',
    'Spécialités mexicaines',
  ],

  bringOptions: [
    { key: 'salade', label: 'Une salade' },
    { key: 'viande', label: 'De la viande' },
    { key: 'fromage', label: 'Du fromage' },
    { key: 'dessert', label: 'Un dessert' },
    { key: 'boisson', label: 'Des boissons' },
  ],
};
