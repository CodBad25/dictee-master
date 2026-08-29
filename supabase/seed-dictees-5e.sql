-- Seed des 16 dictées 5e (progression de la collègue de français, août 2026).
-- Généré par scripts/generate-seed-5e.mjs — NE PAS ÉDITER À LA MAIN.
-- Idempotent : rejouable sans risque (DELETE puis INSERT des dictee-5e-%).
-- Prérequis : supabase/migration-level.sql appliquée.

BEGIN;

DELETE FROM dictee_words WHERE dictee_id LIKE 'dictee-5e-%';
DELETE FROM dictees WHERE id LIKE 'dictee-5e-%';

-- Dictée n°1 — l'observation (⭐ scruter)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-1', 'Dictée n°1', 1, '5EME01', 'À l''entrée du village, Lina s''arrête devant une vieille maison. Elle observe attentivement les fenêtres et examine la porte. Un détail attire le regard : une pierre est déplacée et laisse apparaître une petite marque. Lina vient aussi d''apercevoir un indice dans la poussière. Elle reste à distance. À cet endroit, tout est calme. La jeune fille est curieuse. Elle a le sentiment que la maison cache un secret. Elle avance lentement et se demande à qui appartient la maison.', 'À l''entrée du village, Lina s''arrête devant une vieille maison. Elle observe attentivement les fenêtres et examine la porte. Un détail attire le regard : une pierre est déplacée et laisse apparaître une petite marque. Lina vient aussi d''apercevoir un indice dans la poussière. Elle reste à distance. À cet endroit, tout est calme. La jeune fille est curieuse. Elle a le sentiment que la maison cache un secret. Elle avance lentement et se demande à qui appartient la maison.', '5e', 'a / à ; et / est', 'l''observation', 'scruter');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-1', 'scruter', 'Observer avec une très grande attention pour découvrir un détail', '["scrutter","skruter","scruther"]'::jsonb, 0),
  ('dictee-5e-1', 'examiner', 'Regarder quelque chose avec soin pour bien le connaître', '["éxaminer","examinner","exsaminer"]'::jsonb, 1),
  ('dictee-5e-1', 'apercevoir', 'Voir rapidement ou de loin, sans bien distinguer', '["appercevoir","apersevoir","apercevoire"]'::jsonb, 2),
  ('dictee-5e-1', 'observer', 'Regarder attentivement pour étudier', '["obcerver","opserver","obsserver"]'::jsonb, 3),
  ('dictee-5e-1', 'un détail', 'Petit élément d''un ensemble', '["un détaille","un detail","un détaile"]'::jsonb, 4),
  ('dictee-5e-1', 'un indice', 'Signe qui aide à découvrir la vérité', '["un indisse","un endice","un indyce"]'::jsonb, 5),
  ('dictee-5e-1', 'le regard', 'Action de diriger les yeux vers quelque chose', '["le regart","le reguard","le regare"]'::jsonb, 6),
  ('dictee-5e-1', 'curieux', 'Qui a envie de découvrir et de comprendre', '["curieu","qurieux","curyeux"]'::jsonb, 7),
  ('dictee-5e-1', 'visible', 'Que l''on peut voir', '["vissible","vizible","visibl"]'::jsonb, 8),
  ('dictee-5e-1', 'attentivement', 'En faisant très attention', '["atentivement","attentivemant","attentivemment"]'::jsonb, 9);

-- Dictée n°2 — l'exploration (⭐ arpenter)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-2', 'Dictée n°2', 2, '5EME02', 'Au matin, les voyageurs s''aventurent sur un sentier isolé. Ils ont un itinéraire précis à suivre et la région est inexplorée. Leur périple commence par un long détour autour d''une rivière. Ils arpentent ensuite des montagnes et contournent des roches. Le paysage devient plus sauvage. À midi, ils aperçoivent une cabane. Elle est à plusieurs heures de marche et ils sont heureux de trouver un refuge. André sort de son sac leur déjeuner. Ils sont épuisés mais n''ont qu''une envie : poursuivre l''exploration !', 'Au matin, les voyageurs s''aventurent sur un sentier isolé. Ils ont un itinéraire précis à suivre et la région est inexplorée. Leur périple commence par un long détour autour d''une rivière. Ils arpentent ensuite des montagnes et contournent des roches. Le paysage devient plus sauvage. À midi, ils aperçoivent une cabane. Elle est à plusieurs heures de marche et ils sont heureux de trouver un refuge. André sort de son sac leur déjeuner. Ils sont épuisés mais n''ont qu''une envie : poursuivre l''exploration !', '5e', 'on / ont ; son / sont', 'l''exploration', 'arpenter');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-2', 'arpenter', 'Parcourir à grands pas ou en tous sens', '["arpanter","arpentter","harpenter"]'::jsonb, 0),
  ('dictee-5e-2', 'contourner', 'Faire le tour d''un obstacle pour l''éviter', '["containner","contournner","comtourner"]'::jsonb, 1),
  ('dictee-5e-2', 's''aventurer', 'Aller quelque part malgré le risque', '["s''avanturer","s''aventurrer","s''aventhurer"]'::jsonb, 2),
  ('dictee-5e-2', 'un sentier', 'Chemin étroit dans la nature', '["un santier","un centier","un sentié"]'::jsonb, 3),
  ('dictee-5e-2', 'un périple', 'Long voyage avec de nombreuses étapes', '["un péripple","un perriple","un péripl"]'::jsonb, 4),
  ('dictee-5e-2', 'un détour', 'Chemin plus long que le trajet direct', '["un daitour","un détourt","un déttour"]'::jsonb, 5),
  ('dictee-5e-2', 'un paysage', 'Étendue de pays que l''on voit d''un endroit', '["un payssage","un paisage","un payzage"]'::jsonb, 6),
  ('dictee-5e-2', 'un itinéraire', 'Chemin à suivre pour aller d''un lieu à un autre', '["un itinérère","un ittinéraire","un itinairaire"]'::jsonb, 7),
  ('dictee-5e-2', 'isolé', 'Éloigné de tout, séparé des autres', '["izolé","issolé","isollé"]'::jsonb, 8),
  ('dictee-5e-2', 'inexploré', 'Que personne n''a encore exploré', '["innexploré","inéxploré","inexplorré"]'::jsonb, 9);

-- Dictée n°3 — la prudence et la méfiance (⭐ présager)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-3', 'Dictée n°3', 3, '5EME03', 'Le chemin devient étroit et les voyageurs se méfient de ce silence qui les entoure. Ils se dissimulent derrière les arbres et, à chaque bruit, ils se retournent avec inquiétude. Ils guettent le moindre signe d''une menace. Leur vigilance est constante car une alerte peut surgir à tout moment. Soudain, l''un d''entre eux entend un bruit inhabituel et présage un danger. Il redouble d''attention, avance prudemment et observe les buissons. Ses compagnons le suivent en silence. Bientôt, tous se demandent si un danger est vraiment à craindre.', 'Le chemin devient étroit et les voyageurs se méfient de ce silence qui les entoure. Ils se dissimulent derrière les arbres et, à chaque bruit, ils se retournent avec inquiétude. Ils guettent le moindre signe d''une menace. Leur vigilance est constante car une alerte peut surgir à tout moment. Soudain, l''un d''entre eux entend un bruit inhabituel et présage un danger. Il redouble d''attention, avance prudemment et observe les buissons. Ses compagnons le suivent en silence. Bientôt, tous se demandent si un danger est vraiment à craindre.', '5e', 'ce / se ; ces / ses', 'la prudence et la méfiance', 'présager');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-3', 'présager', 'Annoncer ce qui va se produire, laisser prévoir', '["prézager","préssager","praisager"]'::jsonb, 0),
  ('dictee-5e-3', 'se méfier', 'Ne pas faire confiance, rester sur ses gardes', '["se méffier","se méphier","se maifier"]'::jsonb, 1),
  ('dictee-5e-3', 'se dissimuler', 'Se cacher pour ne pas être vu', '["se dicimuler","se disimuler","se dissimuller"]'::jsonb, 2),
  ('dictee-5e-3', 'guetter', 'Surveiller attentivement en attendant quelque chose', '["guéter","ghetter","gueter"]'::jsonb, 3),
  ('dictee-5e-3', 'une menace', 'Danger possible', '["une menasse","une mennace","une menaçe"]'::jsonb, 4),
  ('dictee-5e-3', 'la vigilance', 'Surveillance attentive et continue', '["la vigillance","la vijilance","la vigilence"]'::jsonb, 5),
  ('dictee-5e-3', 'l''inquiétude', 'Peur légère, souci', '["l''inquiètude","l''inquiétute","l''einquiétude"]'::jsonb, 6),
  ('dictee-5e-3', 'une alerte', 'Signal qui prévient d''un danger', '["une allerte","une alairte","une alertte"]'::jsonb, 7),
  ('dictee-5e-3', 'inhabituel', 'Qui n''arrive pas d''habitude, anormal', '["inabituel","innhabituel","inhabittuel"]'::jsonb, 8),
  ('dictee-5e-3', 'prudemment', 'Avec prudence, en faisant attention', '["prudament","prudemant","prudemement"]'::jsonb, 9);

-- Dictée n°4 — la lumière (⭐ irradier)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-4', 'Dictée n°4', 4, '5EME04', 'Le soleil commence à descendre derrière les hautes montagnes. Ses derniers rayons ont déjà illuminé le paysage et une lueur dorée se reflète sur les eaux profondes du lac. Au loin, vous regardez les sommets qui semblent scintiller. Peu à peu, la lumière faiblit et la pénombre gagne les chemins. Pourtant, les pierres conservent un éclat presque éblouissant. Une bande rose irradie au-dessus des nuages. Vous, voyageurs fatigués, vous levez les yeux pour admirer le ciel et vous restez silencieux devant ce sublime spectacle de la nature.', 'Le soleil commence à descendre derrière les hautes montagnes. Ses derniers rayons ont déjà illuminé le paysage et une lueur dorée se reflète sur les eaux profondes du lac. Au loin, vous regardez les sommets qui semblent scintiller. Peu à peu, la lumière faiblit et la pénombre gagne les chemins. Pourtant, les pierres conservent un éclat presque éblouissant. Une bande rose irradie au-dessus des nuages. Vous, voyageurs fatigués, vous levez les yeux pour admirer le ciel et vous restez silencieux devant ce sublime spectacle de la nature.', '5e', 'é / er / ez', 'la lumière', 'irradier');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-4', 'irradier', 'Se répandre en rayonnant, comme une lumière', '["iradier","irradyer","irrradier"]'::jsonb, 0),
  ('dictee-5e-4', 'scintiller', 'Briller en jetant de petits éclats de lumière', '["sintiller","scintiler","çintiller"]'::jsonb, 1),
  ('dictee-5e-4', 'refléter', 'Renvoyer une image ou une lumière', '["reffléter","refleter","reflaiter"]'::jsonb, 2),
  ('dictee-5e-4', 'illuminer', 'Éclairer d''une vive lumière', '["iluminer","iluminner","ilumminer"]'::jsonb, 3),
  ('dictee-5e-4', 'faiblir', 'Perdre de sa force ou de son intensité', '["féblir","faiblire","faibllir"]'::jsonb, 4),
  ('dictee-5e-4', 'la pénombre', 'Lumière faible, entre l''ombre et la clarté', '["la pénonbre","la painombre","la pénombe"]'::jsonb, 5),
  ('dictee-5e-4', 'une lueur', 'Lumière faible ou passagère', '["une luer","une lueure","une luheur"]'::jsonb, 6),
  ('dictee-5e-4', 'un rayon', 'Trait de lumière', '["un raillon","un rayont","un réyon"]'::jsonb, 7),
  ('dictee-5e-4', 'un éclat', 'Lumière vive et brillante', '["un écla","un éclas","un aiclat"]'::jsonb, 8),
  ('dictee-5e-4', 'éblouissant', 'Si brillant qu''il gêne les yeux', '["éblouisant","ébluissant","éblouïssant"]'::jsonb, 9);

-- Dictée n°5 — l'émerveillement (⭐ enchantement)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-5', 'Dictée n°5', 5, '5EME05', 'Sur la grande place, un spectacle attire les habitants. Les enfants admirent les artistes, s''émerveillent devant les couleurs et s''extasient devant les costumes. Les musiciens jouent une mélodie envoûtante que le public écoute en silence. Au fond, derrière les musiciens et les spectateurs, se dressent de grands décors colorés. La foule se bouscule car chacun veut admirer ce spectacle fascinant de près et les plus jeunes s''émerveillent devant chaque nouvelle scène. Sur les visages naissent des sourires. Cette merveille plaît à tous et enchante même les adultes. Profondément touchés, ils restent longtemps à contempler les artistes.', 'Sur la grande place, un spectacle attire les habitants. Les enfants admirent les artistes, s''émerveillent devant les couleurs et s''extasient devant les costumes. Les musiciens jouent une mélodie envoûtante que le public écoute en silence. Au fond, derrière les musiciens et les spectateurs, se dressent de grands décors colorés. La foule se bouscule car chacun veut admirer ce spectacle fascinant de près et les plus jeunes s''émerveillent devant chaque nouvelle scène. Sur les visages naissent des sourires. Cette merveille plaît à tous et enchante même les adultes. Profondément touchés, ils restent longtemps à contempler les artistes.', '5e', 'L''accord sujet-verbe au présent', 'l''émerveillement', 'enchantement');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-5', 'un enchantement', 'Émerveillement magique, charme extraordinaire', '["un anchantement","un enchantemant","un enchentement"]'::jsonb, 0),
  ('dictee-5e-5', 'admirer', 'Regarder avec plaisir ce que l''on trouve beau', '["atmirer","admirrer","admiirer"]'::jsonb, 1),
  ('dictee-5e-5', 'contempler', 'Regarder longuement avec admiration', '["contanpler","contempller","comtempler"]'::jsonb, 2),
  ('dictee-5e-5', 's''émerveiller', 'Éprouver une grande admiration mêlée de surprise', '["s''émervailler","s''émmerveiller","s''émerveyer"]'::jsonb, 3),
  ('dictee-5e-5', 's''extasier', 'Montrer une admiration très vive', '["s''extazier","s''exthasier","s''exstasier"]'::jsonb, 4),
  ('dictee-5e-5', 'une merveille', 'Chose qui provoque une grande admiration', '["une merveil","une mervaille","une mérveille"]'::jsonb, 5),
  ('dictee-5e-5', 'un éblouissement', 'Émerveillement si fort qu''il éblouit', '["un éblouisement","un ébluissement","un éblouissemant"]'::jsonb, 6),
  ('dictee-5e-5', 'fascinant', 'Qui attire et retient irrésistiblement l''attention', '["facinant","fassinant","fascinnant"]'::jsonb, 7),
  ('dictee-5e-5', 'envoûtant', 'Qui charme comme par magie', '["envoutant","anvoûtant","envoûttant"]'::jsonb, 8),
  ('dictee-5e-5', 'profondément', 'De manière très forte, intense', '["profondement","profondémant","proffondément"]'::jsonb, 9);

-- Dictée n°6 — l'effort et la volonté (⭐ persévérance)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-6', 'Dictée n°6', 6, '5EME06', 'Depuis plusieurs semaines, Manon prépare un spectacle de marionnettes. Avec une grande détermination, elle entreprend de fabriquer de nouvelles marionnettes et s''efforce de leur donner des expressions vivantes. Malgré ses longues soirées de travail, sa persévérance et son courage ne faiblissent pas. Cette jeune artiste déterminée, opiniâtre et tenace sait que chaque effort a une valeur. Elle travaille résolument et inlassablement pour terminer cet incroyable décor. Un soir, tout est prêt. « Préparez vos costumes ! » peut-elle enfin dire à ses camarades. Les spectateurs vont bientôt pouvoir profiter du spectacle et d''une soirée probablement magique.', 'Depuis plusieurs semaines, Manon prépare un spectacle de marionnettes. Avec une grande détermination, elle entreprend de fabriquer de nouvelles marionnettes et s''efforce de leur donner des expressions vivantes. Malgré ses longues soirées de travail, sa persévérance et son courage ne faiblissent pas. Cette jeune artiste déterminée, opiniâtre et tenace sait que chaque effort a une valeur. Elle travaille résolument et inlassablement pour terminer cet incroyable décor. Un soir, tout est prêt. « Préparez vos costumes ! » peut-elle enfin dire à ses camarades. Les spectateurs vont bientôt pouvoir profiter du spectacle et d''une soirée probablement magique.', '5e', 'L''accord dans le groupe nominal (déterminant-nom-adjectif)', 'l''effort et la volonté', 'persévérance');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-6', 'la persévérance', 'Qualité de celui qui continue ses efforts sans se décourager', '["la perséverance","la persévérence","la perceverance"]'::jsonb, 0),
  ('dictee-5e-6', 'entreprendre', 'Commencer à faire quelque chose d''important', '["entreprandre","antreprendre","entrepremdre"]'::jsonb, 1),
  ('dictee-5e-6', 's''efforcer', 'Faire tous ses efforts pour réussir', '["s''éforcer","s''efforsser","s''esforcer"]'::jsonb, 2),
  ('dictee-5e-6', 'le courage', 'Force qui permet d''affronter les difficultés', '["le courrage","le couraje","le kourage"]'::jsonb, 3),
  ('dictee-5e-6', 'un effort', 'Énergie que l''on dépense pour réussir', '["un éfort","un effor","un èffort"]'::jsonb, 4),
  ('dictee-5e-6', 'déterminé', 'Qui est décidé, qui sait ce qu''il veut', '["determiné","déterminné","détérminé"]'::jsonb, 5),
  ('dictee-5e-6', 'opiniâtre', 'Qui ne renonce jamais, très obstiné', '["opiniatre","oppiniâtre","opignâtre"]'::jsonb, 6),
  ('dictee-5e-6', 'tenace', 'Qui tient bon, qui n''abandonne pas', '["tenasse","tennace","thenace"]'::jsonb, 7),
  ('dictee-5e-6', 'résolument', 'Avec décision, sans hésiter', '["résolumment","raisolument","rézolument"]'::jsonb, 8),
  ('dictee-5e-6', 'inlassablement', 'Sans jamais se fatiguer ni s''arrêter', '["inlasablement","inlassablemant","einlassablement"]'::jsonb, 9);

-- Dictée n°7 — le relief et la montagne (⭐ serpenter)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-7', 'Dictée n°7', 7, '5EME07', 'La montagne s''élevait devant les voyageurs et dominait toute la vallée. Le sentier serpentait sur un versant escarpé, puis longeait une falaise abrupte. Plus haut, les sommets semblaient culminer sous les épais nuages gris. Un grand rocher surplombait le chemin et obligeait les marcheurs à ralentir. Malgré la pente, ils avançaient avec prudence. Ils continuaient inlassablement leur marche pour atteindre le refuge avant la nuit. Le soleil éclairait majestueusement les reliefs. À mesure qu''ils montaient, la vallée paraissait plus petite. Ils s''arrêtaient parfois pour admirer ce paysage envoûtant et reprenaient ensuite rapidement leur marche.', 'La montagne s''élevait devant les voyageurs et dominait toute la vallée. Le sentier serpentait sur un versant escarpé, puis longeait une falaise abrupte. Plus haut, les sommets semblaient culminer sous les épais nuages gris. Un grand rocher surplombait le chemin et obligeait les marcheurs à ralentir. Malgré la pente, ils avançaient avec prudence. Ils continuaient inlassablement leur marche pour atteindre le refuge avant la nuit. Le soleil éclairait majestueusement les reliefs. À mesure qu''ils montaient, la vallée paraissait plus petite. Ils s''arrêtaient parfois pour admirer ce paysage envoûtant et reprenaient ensuite rapidement leur marche.', '5e', 'Les terminaisons de l''imparfait (-ais, -ait, -ions…)', 'le relief et la montagne', 'serpenter');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-7', 'serpenter', 'Suivre un chemin qui fait de nombreux virages', '["serpanter","serpentter","sérpenter"]'::jsonb, 0),
  ('dictee-5e-7', 's''élever', 'Monter, se dresser vers le haut', '["s''éllever","s''élevver","s''éléver"]'::jsonb, 1),
  ('dictee-5e-7', 'surplomber', 'Dominer en avançant au-dessus du vide', '["surplonber","surplommber","surplommer"]'::jsonb, 2),
  ('dictee-5e-7', 'culminer', 'Atteindre son point le plus haut', '["culmminer","kulminer","qulminer"]'::jsonb, 3),
  ('dictee-5e-7', 'un sommet', 'Point le plus haut d''une montagne', '["un somet","un sommé","un sommait"]'::jsonb, 4),
  ('dictee-5e-7', 'un versant', 'Pente d''une montagne', '["un vairsant","un verssant","un versan"]'::jsonb, 5),
  ('dictee-5e-7', 'une falaise', 'Paroi rocheuse très raide, souvent au bord de la mer', '["une fallaise","une falèse","une phalaise"]'::jsonb, 6),
  ('dictee-5e-7', 'escarpé', 'En pente raide, difficile à gravir', '["aiscarpé","éscarpé","escarppé"]'::jsonb, 7),
  ('dictee-5e-7', 'abrupt', 'Très raide, presque vertical', '["abruppt","abrup","habrupt"]'::jsonb, 8),
  ('dictee-5e-7', 'majestueusement', 'Avec une beauté imposante et noble', '["magestueusement","majestueusemant","majestueuzement"]'::jsonb, 9);

-- Dictée n°8 — l'inconnu et le mystère (⭐ énigmatique)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-8', 'Dictée n°8', 8, '5EME08', 'Au fond d''une vallée, les voyageurs découvrirent une grande maison de pierre qu''aucune carte ne signalait. L''un d''eux avança et aperçut une silhouette étrange derrière la porte. Elle surgit tout à coup dans la pénombre, puis disparut. Les compagnons cherchèrent à déceler un signe, mais rien ne leur permit de comprendre cette apparition. Peu à peu, un symbole se dévoila sur le mur. Sa forme était presque insaisissable. Ils entrèrent prudemment et avancèrent dans le couloir. Une voix résonna alors derrière eux et ils se retournèrent avec inquiétude. Il n''y avait personne mais la lourde porte se referma mystérieusement.', 'Au fond d''une vallée, les voyageurs découvrirent une grande maison de pierre qu''aucune carte ne signalait. L''un d''eux avança et aperçut une silhouette étrange derrière la porte. Elle surgit tout à coup dans la pénombre, puis disparut. Les compagnons cherchèrent à déceler un signe, mais rien ne leur permit de comprendre cette apparition. Peu à peu, un symbole se dévoila sur le mur. Sa forme était presque insaisissable. Ils entrèrent prudemment et avancèrent dans le couloir. Une voix résonna alors derrière eux et ils se retournèrent avec inquiétude. Il n''y avait personne mais la lourde porte se referma mystérieusement.', '5e', 'Les terminaisons du passé simple (3e personne surtout)', 'l''inconnu et le mystère', 'énigmatique');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-8', 'énigmatique', 'Difficile à comprendre, mystérieux', '["énigmatic","énigmattique","énygmatique"]'::jsonb, 0),
  ('dictee-5e-8', 'disparaître', 'Cesser d''être visible', '["disparaitre","dispareître","dissparaître"]'::jsonb, 1),
  ('dictee-5e-8', 'surgir', 'Apparaître brusquement', '["surjir","surgire","sûrgir"]'::jsonb, 2),
  ('dictee-5e-8', 'déceler', 'Découvrir ce qui était caché', '["déseler","décceler","désseler"]'::jsonb, 3),
  ('dictee-5e-8', 'dévoiler', 'Révéler ce qui était secret', '["daivoiler","dévoiller","dévoualer"]'::jsonb, 4),
  ('dictee-5e-8', 'une silhouette', 'Forme générale d''une personne vue de loin ou dans l''ombre', '["une silouette","une silhouète","une sillouette"]'::jsonb, 5),
  ('dictee-5e-8', 'une apparition', 'Fait de se montrer soudainement', '["une aparition","une apparission","une apparittion"]'::jsonb, 6),
  ('dictee-5e-8', 'étrange', 'Qui surprend, inhabituel et mystérieux', '["étranje","aitrange","étrangge"]'::jsonb, 7),
  ('dictee-5e-8', 'insaisissable', 'Que l''on ne peut ni attraper ni comprendre', '["insaisisable","insésissable","inssaisissable"]'::jsonb, 8),
  ('dictee-5e-8', 'mystérieusement', 'D''une manière étrange et inexpliquée', '["mistérieusement","mystérieusemant","mystérieuzement"]'::jsonb, 9);

-- Dictée n°9 — la ruse (⭐ perfidie)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-9', 'Dictée n°9', 9, '5EME09', 'Les voyageurs firent face, dans une autre vallée, à un très ancien château. Ils ne s''attendaient pas à découvrir un lieu aussi étrange. Depuis longtemps, une légende évoquait un passage secret sous les ruines. Le guide avait étudié plusieurs cartes et avait astucieusement préparé son stratagème car, pour visiter ce passage, il fallait leurrer les gardes qui bloquaient l''accès. Le guide feignit donc de chercher l''entrée principale, alors qu''il avait repéré une porte dissimulée. Les autres le suivirent. Il avait manigancé cette ruse avec malice pour éviter les gardes qui surveillaient le chemin. Son plan, imaginé longtemps à l''avance, fonctionna parfaitement.', 'Les voyageurs firent face, dans une autre vallée, à un très ancien château. Ils ne s''attendaient pas à découvrir un lieu aussi étrange. Depuis longtemps, une légende évoquait un passage secret sous les ruines. Le guide avait étudié plusieurs cartes et avait astucieusement préparé son stratagème car, pour visiter ce passage, il fallait leurrer les gardes qui bloquaient l''accès. Le guide feignit donc de chercher l''entrée principale, alors qu''il avait repéré une porte dissimulée. Les autres le suivirent. Il avait manigancé cette ruse avec malice pour éviter les gardes qui surveillaient le chemin. Son plan, imaginé longtemps à l''avance, fonctionna parfaitement.', '5e', 'Le plus-que-parfait', 'la ruse', 'perfidie');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-9', 'la perfidie', 'Méchanceté de celui qui trahit en cachette', '["la perfidi","la pairfidie","la perffidie"]'::jsonb, 0),
  ('dictee-5e-9', 'leurrer', 'Tromper par de fausses apparences', '["leurer","lheurrer","leaurer"]'::jsonb, 1),
  ('dictee-5e-9', 'feindre', 'Faire semblant', '["faindre","feindres","feintre"]'::jsonb, 2),
  ('dictee-5e-9', 'manigancer', 'Préparer en secret un mauvais coup', '["maniganser","manigencer","manniganser"]'::jsonb, 3),
  ('dictee-5e-9', 'dissimuler', 'Cacher volontairement', '["disimuler","diçimuler","dissimmuler"]'::jsonb, 4),
  ('dictee-5e-9', 'un stratagème', 'Ruse habile pour tromper', '["un stratagem","un stratagéme","un strattagème"]'::jsonb, 5),
  ('dictee-5e-9', 'la malice', 'Esprit moqueur qui aime jouer des tours', '["la malisse","la mallice","la malyce"]'::jsonb, 6),
  ('dictee-5e-9', 'fourbe', 'Qui trompe avec hypocrisie', '["fourb","fourbbe","phourbe"]'::jsonb, 7),
  ('dictee-5e-9', 'sournois', 'Qui cache ses véritables intentions', '["sournoi","sournnois","sournoit"]'::jsonb, 8),
  ('dictee-5e-9', 'astucieusement', 'Avec habileté et intelligence', '["astucieusemant","astussieusement","astucieuzement"]'::jsonb, 9);

-- Dictée n°10 — le souvenir (⭐ nostalgie)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-10', 'Dictée n°10', 10, '5EME10', 'Quand elle entre dans le vieux théâtre, Clara est saisie par une étrange émotion. Elle se remémore aussitôt les spectacles vus autrefois avec sa mère quand elle était enfant. Les rideaux rouges sont encore suspendus et d''anciennes affiches sont accrochées aux murs. Clara se souvient de moments mémorables passés dans cet endroit. Les chansons que sa mère aimait lui reviennent aussi en mémoire. Ces souvenirs, conservés à travers les années, lui semblent inoubliables. Elle sent monter en elle une douce nostalgie. Elle n''est pourtant pas oublieuse de ses autres souvenirs, mais celui-ci reste pour elle le plus précieux.', 'Quand elle entre dans le vieux théâtre, Clara est saisie par une étrange émotion. Elle se remémore aussitôt les spectacles vus autrefois avec sa mère quand elle était enfant. Les rideaux rouges sont encore suspendus et d''anciennes affiches sont accrochées aux murs. Clara se souvient de moments mémorables passés dans cet endroit. Les chansons que sa mère aimait lui reviennent aussi en mémoire. Ces souvenirs, conservés à travers les années, lui semblent inoubliables. Elle sent monter en elle une douce nostalgie. Elle n''est pourtant pas oublieuse de ses autres souvenirs, mais celui-ci reste pour elle le plus précieux.', '5e', 'L''accord du participe passé avec être et sans auxiliaire', 'le souvenir', 'nostalgie');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-10', 'la nostalgie', 'Tristesse douce liée au regret du passé', '["la nostalgi","la nostralgie","la nostaljie"]'::jsonb, 0),
  ('dictee-5e-10', 'évoquer', 'Rappeler à la mémoire', '["évauquer","évocquer","aivoquer"]'::jsonb, 1),
  ('dictee-5e-10', 'se remémorer', 'Se rappeler avec précision', '["se remaimorer","se rémémorer","se remmémorer"]'::jsonb, 2),
  ('dictee-5e-10', 'se rappeler', 'Faire revenir un souvenir dans sa mémoire', '["se rapeler","se rapeller","se rappeller"]'::jsonb, 3),
  ('dictee-5e-10', 'se souvenir', 'Garder en mémoire', '["se souvenire","se souvennir","se çouvenir"]'::jsonb, 4),
  ('dictee-5e-10', 'la mémoire', 'Capacité de se souvenir', '["la maimoire","la mémoir","la mémmoire"]'::jsonb, 5),
  ('dictee-5e-10', 'mémorable', 'Digne d''être retenu, inoubliable', '["mémorrable","maimorable","mémorabl"]'::jsonb, 6),
  ('dictee-5e-10', 'inoubliable', 'Que l''on ne peut pas oublier', '["inoubliabl","innoubliable","inoublyable"]'::jsonb, 7),
  ('dictee-5e-10', 'oublieux', 'Qui oublie facilement', '["oublieu","oubllieux","oubliyeux"]'::jsonb, 8),
  ('dictee-5e-10', 'autrefois', 'Dans le passé, il y a longtemps', '["autrefoi","otrefois","autrefoie"]'::jsonb, 9);

-- Dictée n°11 — la bonté (⭐ bienveillance)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-11', 'Dictée n°11', 11, '5EME11', 'Lorsque le jeune garçon est entré dans le village, c''est une vieille femme qui l''a accueilli et réconforté avec bienveillance. Dans le village, tous la connaissaient pour son altruisme et sa magnanimité : elle parlait généreusement aux plus pauvres, les encourageait, elle aidait les autres sans attendre de récompense, accordait son pardon, se montrait indulgente, charitable et clémente. C''est pourquoi sa bonté était célèbre dans toute la région. Ainsi, dès son arrivée, le jeune garçon s''est senti rassuré. Les douces paroles de la femme l''ont sécurisé et il a pu rejoindre sa famille l''esprit calme. Était-elle une fée ? C''est la question qu''il se posait.', 'Lorsque le jeune garçon est entré dans le village, c''est une vieille femme qui l''a accueilli et réconforté avec bienveillance. Dans le village, tous la connaissaient pour son altruisme et sa magnanimité : elle parlait généreusement aux plus pauvres, les encourageait, elle aidait les autres sans attendre de récompense, accordait son pardon, se montrait indulgente, charitable et clémente. C''est pourquoi sa bonté était célèbre dans toute la région. Ainsi, dès son arrivée, le jeune garçon s''est senti rassuré. Les douces paroles de la femme l''ont sécurisé et il a pu rejoindre sa famille l''esprit calme. Était-elle une fée ? C''est la question qu''il se posait.', '5e', 'c''est / s''est', 'la bonté', 'bienveillance');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-11', 'la bienveillance', 'Disposition à vouloir du bien aux autres', '["la bienveillence","la bienvaillance","la bienveyance"]'::jsonb, 0),
  ('dictee-5e-11', 'encourager', 'Donner du courage, soutenir', '["encourajer","ancourager","encourrager"]'::jsonb, 1),
  ('dictee-5e-11', 'réconforter', 'Redonner des forces et du moral', '["raiconforter","réconphorter","récomforter"]'::jsonb, 2),
  ('dictee-5e-11', 'rassurer', 'Rendre la confiance, faire disparaître la peur', '["rasurer","raçurer","rassurrer"]'::jsonb, 3),
  ('dictee-5e-11', 'l''altruisme', 'Souci de faire du bien aux autres sans rien attendre', '["l''altruime","l''altruïsme","l''altrouisme"]'::jsonb, 4),
  ('dictee-5e-11', 'la magnanimité', 'Grandeur d''âme, générosité qui pardonne', '["la magnanimitée","la magnaninité","la magnianimité"]'::jsonb, 5),
  ('dictee-5e-11', 'indulgent', 'Qui pardonne facilement', '["indulgant","indhulgent","indulgeant"]'::jsonb, 6),
  ('dictee-5e-11', 'clément', 'Qui punit avec douceur, qui pardonne', '["claiment","cléman","clémant"]'::jsonb, 7),
  ('dictee-5e-11', 'charitable', 'Qui aide généreusement les plus démunis', '["charitabl","charittable","charitablle"]'::jsonb, 8),
  ('dictee-5e-11', 'généreusement', 'Avec générosité, sans compter', '["génereusement","généreusemant","généreuzement"]'::jsonb, 9);

-- Dictée n°12 — le bruit (⭐ tumulte)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-12', 'Dictée n°12', 12, '5EME12', 'La nuit était calme lorsque le premier bruit retentit. Un fracas éclata derrière les maisons, puis un vacarme assourdissant résonna dans la rue où la pénombre régnait. Les habitants s''approchèrent des fenêtres, cherchant derrière les vitres l''origine de ce tumulte. C''était un orage dont les grondements faisaient trembler les maisons. Les habitants ne savaient plus où regarder. Et que faire ? Fallait-il descendre à la cave ou simplement éteindre les lumières ? Au loin, le tonnerre grondait bruyamment. La pluie tomba soudain avec force ou plutôt s''abattit comme un mur d''eau. Lorsque l''orage s''éloigna, les habitants retrouvèrent le calme. Ils racontèrent longtemps cet événement dont ils se souviendraient.', 'La nuit était calme lorsque le premier bruit retentit. Un fracas éclata derrière les maisons, puis un vacarme assourdissant résonna dans la rue où la pénombre régnait. Les habitants s''approchèrent des fenêtres, cherchant derrière les vitres l''origine de ce tumulte. C''était un orage dont les grondements faisaient trembler les maisons. Les habitants ne savaient plus où regarder. Et que faire ? Fallait-il descendre à la cave ou simplement éteindre les lumières ? Au loin, le tonnerre grondait bruyamment. La pluie tomba soudain avec force ou plutôt s''abattit comme un mur d''eau. Lorsque l''orage s''éloigna, les habitants retrouvèrent le calme. Ils racontèrent longtemps cet événement dont ils se souviendraient.', '5e', 'ou / où + dont', 'le bruit', 'tumulte');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-12', 'le tumulte', 'Grand désordre bruyant', '["le tumult","le tumullte","le thumulte"]'::jsonb, 0),
  ('dictee-5e-12', 'résonner', 'Produire un son qui se prolonge', '["résoner","raisonner","résonné"]'::jsonb, 1),
  ('dictee-5e-12', 'éclater', 'Se produire brusquement avec bruit', '["éclatter","écclater","aiclater"]'::jsonb, 2),
  ('dictee-5e-12', 'gronder', 'Produire un bruit sourd et menaçant', '["gromder","gronnder","grondder"]'::jsonb, 3),
  ('dictee-5e-12', 'retentir', 'Se faire entendre avec force', '["retantir","rettentir","retentire"]'::jsonb, 4),
  ('dictee-5e-12', 'le vacarme', 'Bruit très fort et désordonné', '["le vaccarme","le vacarm","le vakarme"]'::jsonb, 5),
  ('dictee-5e-12', 'le fracas', 'Bruit violent d''une chose qui se brise', '["le fraca","le fracat","le frackas"]'::jsonb, 6),
  ('dictee-5e-12', 'le tapage', 'Bruit désordonné et gênant', '["le tappage","le tapaje","le tapagge"]'::jsonb, 7),
  ('dictee-5e-12', 'assourdissant', 'Si fort qu''il rend presque sourd', '["assourdisant","asourdissant","assourdissent"]'::jsonb, 8),
  ('dictee-5e-12', 'bruyamment', 'En faisant beaucoup de bruit', '["bruyament","bruillamment","bruyemment"]'::jsonb, 9);

-- Dictée n°13 — la colère (⭐ furieusement)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-13', 'Dictée n°13', 13, '5EME13', 'Le chef du village s''emporta lorsqu''il apprit la nouvelle. Honteux, certains villageois baissèrent leurs regards devant lui. Il s''irrita contre ceux qui avaient désobéi et fulmina contre leur imprudence. Sa colère grandissait à mesure qu''il entendait leurs excuses. Un homme, exaspéré par ces reproches, finit lui aussi par enrager. La hargne gagnait peu à peu les habitants. Pourtant, une femme resta calme et tenta de modérer les esprits. Elle leur dit de contenir leur colère. Cependant, le chef, encore irascible, parlait furieusement. Ce n''est qu''après un long moment qu''il accepta finalement d''écouter. Son courroux diminua progressivement et le village retrouva son calme. Tous comprirent alors que leur animosité ne résoudrait rien.', 'Le chef du village s''emporta lorsqu''il apprit la nouvelle. Honteux, certains villageois baissèrent leurs regards devant lui. Il s''irrita contre ceux qui avaient désobéi et fulmina contre leur imprudence. Sa colère grandissait à mesure qu''il entendait leurs excuses. Un homme, exaspéré par ces reproches, finit lui aussi par enrager. La hargne gagnait peu à peu les habitants. Pourtant, une femme resta calme et tenta de modérer les esprits. Elle leur dit de contenir leur colère. Cependant, le chef, encore irascible, parlait furieusement. Ce n''est qu''après un long moment qu''il accepta finalement d''écouter. Son courroux diminua progressivement et le village retrouva son calme. Tous comprirent alors que leur animosité ne résoudrait rien.', '5e', 'leur / leurs', 'la colère', 'furieusement');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-13', 'furieusement', 'Avec une très grande colère', '["furieusemant","furrieusement","furieuzement"]'::jsonb, 0),
  ('dictee-5e-13', 's''emporter', 'Se mettre brusquement en colère', '["s''anporter","s''amporter","s''emportter"]'::jsonb, 1),
  ('dictee-5e-13', 's''irriter', 'Se mettre en colère peu à peu', '["s''iriter","s''iritter","s''irritter"]'::jsonb, 2),
  ('dictee-5e-13', 'enrager', 'Éprouver une violente colère', '["enrajer","anrager","enrrager"]'::jsonb, 3),
  ('dictee-5e-13', 'fulminer', 'Exploser de colère en paroles', '["fullminer","fulmminer","phulminer"]'::jsonb, 4),
  ('dictee-5e-13', 'l''animosité', 'Hostilité, mauvais sentiment envers quelqu''un', '["l''animositée","l''annimosité","l''animozité"]'::jsonb, 5),
  ('dictee-5e-13', 'le courroux', 'Colère violente (mot littéraire)', '["le couroux","le courou","le courrou"]'::jsonb, 6),
  ('dictee-5e-13', 'la hargne', 'Mauvaise humeur agressive', '["la harngne","la argne","la hargn"]'::jsonb, 7),
  ('dictee-5e-13', 'irascible', 'Qui se met facilement en colère', '["irrascible","irasible","irassible"]'::jsonb, 8),
  ('dictee-5e-13', 'exaspéré', 'Poussé à bout, très agacé', '["exazpéré","éxaspéré","exasperé"]'::jsonb, 9);

-- Dictée n°14 — le savoir (⭐ érudition)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-14', 'Dictée n°14', 14, '5EME14', 'Le jeune garçon voulait comprendre le monde qui l''entourait. À l''école, il cherchait à assimiler les nouvelles connaissances et écoutait attentivement son professeur. Celui-ci enseignait l''histoire avec passion et répondait à toutes les questions. Quel bonheur pour ce jeune élève ! Quelles leçons profitables ! Avec le temps, l''élève devenait plus averti et plus studieux. Il lisait tous les ouvrages d''un savant dont les travaux étaient célèbres. Peu à peu, il apprit à distinguer les faits des opinions. Ses connaissances s''enrichissaient et tous les adultes admiraient son esprit de plus en plus éclairé. Il travaillait savamment les notions et prenait plaisir. Pour lui, l''érudition devenait un moyen de mieux comprendre le monde et de grandir.', 'Le jeune garçon voulait comprendre le monde qui l''entourait. À l''école, il cherchait à assimiler les nouvelles connaissances et écoutait attentivement son professeur. Celui-ci enseignait l''histoire avec passion et répondait à toutes les questions. Quel bonheur pour ce jeune élève ! Quelles leçons profitables ! Avec le temps, l''élève devenait plus averti et plus studieux. Il lisait tous les ouvrages d''un savant dont les travaux étaient célèbres. Peu à peu, il apprit à distinguer les faits des opinions. Ses connaissances s''enrichissaient et tous les adultes admiraient son esprit de plus en plus éclairé. Il travaillait savamment les notions et prenait plaisir. Pour lui, l''érudition devenait un moyen de mieux comprendre le monde et de grandir.', '5e', 'quel(s) / quelle(s) + tout / tous / toute(s)', 'le savoir', 'érudition');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-14', 'l''érudition', 'Savoir très étendu acquis par l''étude', '["l''éruditions","l''érudission","l''airudition"]'::jsonb, 0),
  ('dictee-5e-14', 'assimiler', 'Comprendre et retenir des connaissances', '["assymiler","asimiler","assimiller"]'::jsonb, 1),
  ('dictee-5e-14', 'enseigner', 'Transmettre des connaissances', '["enségner","anseigner","einseigner"]'::jsonb, 2),
  ('dictee-5e-14', 'un professeur', 'Personne qui enseigne', '["un proffesseur","un profésseur","un professeure"]'::jsonb, 3),
  ('dictee-5e-14', 'une connaissance', 'Ce que l''on sait', '["une conaissance","une connaisance","une connèssance"]'::jsonb, 4),
  ('dictee-5e-14', 'une leçon', 'Ce qu''un élève doit apprendre', '["une lesson","une leson","une lessont"]'::jsonb, 5),
  ('dictee-5e-14', 'averti', 'Qui est informé et expérimenté', '["avairti","aiverti","avverti"]'::jsonb, 6),
  ('dictee-5e-14', 'éclairé', 'Qui a des connaissances et du jugement', '["aiclairé","éclèré","écclairé"]'::jsonb, 7),
  ('dictee-5e-14', 'studieux', 'Qui aime étudier', '["studieu","sturieux","stuadieux"]'::jsonb, 8),
  ('dictee-5e-14', 'savamment', 'Avec beaucoup de savoir, habilement', '["savament","savemment","savammant"]'::jsonb, 9);

-- Dictée n°15 — la réflexion et le jugement (⭐ lucidité)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-15', 'Dictée n°15', 15, '5EME15', 'Après quelques jours d''un long voyage, les compagnons s''arrêtèrent pour réfléchir à leur prochaine étape. Il fallait trouver la meilleure direction afin de poursuivre sans risque. Tous voulaient s''en assurer. Cependant, ils doutaient. La forêt devant eux semblait pouvoir cacher de nombreux secrets. Même le chef, un homme très réfléchi, avisé et clairvoyant, hésitait encore. Leur examen attentif de la carte permit de comparer quelques chemins difficiles. Le chef proposa une solution judicieuse et tous en discutèrent calmement. Ils savaient qu''il leur fallait agir avec une totale lucidité. Le chef expliqua son raisonnement logique. Chacun comprit pourquoi ce choix était le plus raisonnable. Ils étaient même convaincus d''avoir pris la bonne décision. Ils avancèrent donc sans hésiter.', 'Après quelques jours d''un long voyage, les compagnons s''arrêtèrent pour réfléchir à leur prochaine étape. Il fallait trouver la meilleure direction afin de poursuivre sans risque. Tous voulaient s''en assurer. Cependant, ils doutaient. La forêt devant eux semblait pouvoir cacher de nombreux secrets. Même le chef, un homme très réfléchi, avisé et clairvoyant, hésitait encore. Leur examen attentif de la carte permit de comparer quelques chemins difficiles. Le chef proposa une solution judicieuse et tous en discutèrent calmement. Ils savaient qu''il leur fallait agir avec une totale lucidité. Le chef expliqua son raisonnement logique. Chacun comprit pourquoi ce choix était le plus raisonnable. Ils étaient même convaincus d''avoir pris la bonne décision. Ils avancèrent donc sans hésiter.', '5e', 'même, quelque, sans / s''en', 'la réflexion et le jugement', 'lucidité');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-15', 'la lucidité', 'Capacité de voir et de juger clairement les choses', '["la lusidité","la lussidité","la luciditée"]'::jsonb, 0),
  ('dictee-5e-15', 's''assurer', 'Vérifier pour être certain', '["s''asurer","s''açurer","s''assurrer"]'::jsonb, 1),
  ('dictee-5e-15', 'un examen', 'Observation attentive', '["un éxamen","un examin","un exament"]'::jsonb, 2),
  ('dictee-5e-15', 'un raisonnement', 'Enchaînement d''idées qui mène à une conclusion', '["un raisonement","un résonnement","un raisonnemant"]'::jsonb, 3),
  ('dictee-5e-15', 'un choix', 'Décision entre plusieurs possibilités', '["un choi","un choit","un chois"]'::jsonb, 4),
  ('dictee-5e-15', 'réfléchi', 'Qui pense avant d''agir', '["réflèchi","réffléchi","refléchi"]'::jsonb, 5),
  ('dictee-5e-15', 'avisé', 'Qui agit avec intelligence et prudence', '["havisé","avizé","avissé"]'::jsonb, 6),
  ('dictee-5e-15', 'judicieux', 'Qui montre un bon jugement', '["judicieu","judissieux","judicieus"]'::jsonb, 7),
  ('dictee-5e-15', 'clairvoyant', 'Qui voit et comprend les choses avec justesse', '["clervoyant","clairvoillant","clairevoyant"]'::jsonb, 8),
  ('dictee-5e-15', 'convaincu', 'Certain de quelque chose', '["convincu","convainqu","comvaincu"]'::jsonb, 9);

-- Dictée n°16 — l'apaisement (⭐ quiétude)
INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES
  ('dictee-5e-16', 'Dictée n°16', 16, '5EME16', 'Après la dispute, la maison retrouvera lentement son calme. La mère cherchera d''abord à pacifier les échanges et demandera à chacun de parler moins fort. Son ton doux apaisera les esprits et adoucira les paroles. Elle proposera de modérer les reproches. Peu à peu, une profonde tranquillité s''installera dans la pièce. Les voix deviendront plus basses et les visages plus détendus. Le calme retrouvé apportera une véritable consolation aux enfants, rendus inquiets par les cris des adultes. Tous parleront à nouveau avec douceur. Bientôt, l''atmosphère deviendra paisible et sereine. Chacun gagnera en confiance et se sentira mieux. Les sourires reviendront sur les visages. Dans cette maison enfin silencieuse, tous goûteront à la quiétude retrouvée et oublieront leur colère.', 'Après la dispute, la maison retrouvera lentement son calme. La mère cherchera d''abord à pacifier les échanges et demandera à chacun de parler moins fort. Son ton doux apaisera les esprits et adoucira les paroles. Elle proposera de modérer les reproches. Peu à peu, une profonde tranquillité s''installera dans la pièce. Les voix deviendront plus basses et les visages plus détendus. Le calme retrouvé apportera une véritable consolation aux enfants, rendus inquiets par les cris des adultes. Tous parleront à nouveau avec douceur. Bientôt, l''atmosphère deviendra paisible et sereine. Chacun gagnera en confiance et se sentira mieux. Les sourires reviendront sur les visages. Dans cette maison enfin silencieuse, tous goûteront à la quiétude retrouvée et oublieront leur colère.', '5e', 'Le futur', 'l''apaisement', 'quiétude');

INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES
  ('dictee-5e-16', 'la quiétude', 'Calme paisible, tranquillité', '["la quiètude","la quiétute","la kiétude"]'::jsonb, 0),
  ('dictee-5e-16', 'apaiser', 'Rendre calme', '["appaiser","apayser","apéser"]'::jsonb, 1),
  ('dictee-5e-16', 'adoucir', 'Rendre plus doux', '["adousir","addoucir","adouçire"]'::jsonb, 2),
  ('dictee-5e-16', 'modérer', 'Diminuer la force, l''excès', '["maudérer","moddérer","modérrer"]'::jsonb, 3),
  ('dictee-5e-16', 'pacifier', 'Ramener la paix', '["passifier","pacyfier","paçifier"]'::jsonb, 4),
  ('dictee-5e-16', 'soulager', 'Diminuer une douleur ou une peine', '["çoulager","soullager","soulajer"]'::jsonb, 5),
  ('dictee-5e-16', 'une consolation', 'Réconfort donné à quelqu''un qui a du chagrin', '["une consolassion","une consollation","une consolasion"]'::jsonb, 6),
  ('dictee-5e-16', 'la tranquillité', 'État calme et paisible', '["la tranquilité","la tranquillitée","la tranquilitté"]'::jsonb, 7),
  ('dictee-5e-16', 'paisible', 'Calme et doux', '["pésible","paisibl","paissible"]'::jsonb, 8),
  ('dictee-5e-16', 'serein', 'Calme et confiant', '["serin","sereint","cerein"]'::jsonb, 9);

COMMIT;

-- Vérification :
-- SELECT level, COUNT(*) FROM dictees GROUP BY level;   -- attendu : 6e=26+, 5e=16
-- SELECT COUNT(*) FROM dictee_words WHERE dictee_id LIKE 'dictee-5e-%';  -- attendu : 160
