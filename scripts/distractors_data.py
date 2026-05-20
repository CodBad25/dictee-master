"""
Distracteurs (spelling_errors) générés via le moteur GAFF + filtrage manuel.
Cadre théorique : typologie de Nina Catach (phonogrammes, morphogrammes,
logogrammes). Source des règles : https://github.com/momenttech/GAFF (GPL-3.0).

Format : DISTRACTORS[clé] = { "dictee_id": str, "words": [(position, mot, [3 distracteurs]), ...] }
"""

DISTRACTORS = {
    "D13": {
        "dictee_id": "dictee-13",
        "words": [
            (0,  "dangereux (se)",  ["dangereu", "dangèreux", "danjereux"]),
            (1,  "le congé",         ["le conjé", "le congè", "le conger"]),
            (2,  "une ascension",    ["une assension", "une ascansion", "une ascensions"]),
            (3,  "une femelle",      ["une femele", "une femell", "une famelle"]),
            (4,  "la rentrée",       ["la rentré", "la rentrer", "la rantrée"]),
            (5,  "un sommet",        ["un somme", "un sommé", "un somet"]),
            (6,  "le principe",      ["le princip", "le princippe", "le prinsipe"]),
            (7,  "soupirer",         ["soupiré", "soupirait", "soupirée"]),
            (8,  "le soin",          ["le soins", "le soing"]),
            (9,  "une source",       ["une sources", "une sourc"]),
            (10, "le bloc",          ["le blok", "le block", "le blocs"]),
            (11, "généralement",     ["générallement", "generalement", "généralemant"]),
            (12, "le défenseur",     ["le defenseur", "le dèfenseur", "le défanseur"]),
            (13, "l'alpiniste",      ["l'alpinist", "l'alpinisste"]),
            (14, "chevronné (ée)",   ["chevronner", "chevronne", "chevroné"]),
            (15, "la chaussée",      ["la chaussé", "la chausée", "la chausser"]),
            (16, "l'exploit",        ["l'exploi", "l'esploit", "l'exploits"]),
            (17, "épuisé (ée)",      ["épuiser", "epuisé", "épuisè"]),
            (18, "le cerisier",      ["le serisier", "le cerissier", "le cerisié"]),
            (19, "le lin",           ["le lain", "le lins"]),
        ],
    },
}
