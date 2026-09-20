-- Textes d'entraînement des 16 dictées 5e (20/09/2026)
-- Généré par scripts/training-texts-5e.py — vérifié : ≤25 mots, ≤3 phrases,
-- une règle d'accord par trou, aucun trou dépendant d'un autre trou.

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Les deux sœurs sont «curieuses». Elles observent la vitrine : leurs «regards» scrutent des indices peu «visibles». Elles «aperçoivent» des détails attentivement «examinés».',
  'rules', jsonb_build_object(
    'curieuses', 'Adjectif au féminin pluriel : « les deux sœurs »',
    'regards', 'Nom au pluriel : « leurs »',
    'visibles', 'Adjectif accordé avec « des indices » : pluriel',
    'aperçoivent', 'Verbe à la 3e personne du pluriel : « Elles »',
    'examinés', 'Participe passé accordé avec « détails » : masculin pluriel'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-1';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Les randonneuses «épuisées» «arpentent» des sentiers «isolés». Elles «s''aventurent», contournent un rocher : ce détour révèle des paysages «inexplorés». Leur périple suit un itinéraire.',
  'rules', jsonb_build_object(
    'épuisées', 'Adjectif au féminin pluriel : « Les randonneuses »',
    'arpentent', 'Verbe à la 3e personne du pluriel : « Les randonneuses »',
    'isolés', 'Adjectif accordé avec « des sentiers » : masculin pluriel',
    's''aventurent', 'Verbe à la 3e personne du pluriel : « Elles »',
    'inexplorés', 'Adjectif accordé avec « des paysages » : masculin pluriel'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-2';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Des bruits «inhabituels» «présagent» une menace. Les sentinelles se «méfient», se dissimulent et guettent prudemment. Leur vigilance donne l''alerte malgré les «inquiétudes».',
  'rules', jsonb_build_object(
    'inhabituels', 'Adjectif accordé avec « Des bruits » : masculin pluriel',
    'présagent', 'Verbe à la 3e personne du pluriel : « Des bruits »',
    'méfient', 'Verbe à la 3e personne du pluriel : « Les sentinelles »',
    'inquiétudes', 'Nom au pluriel : « les »'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-3';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Dans la pénombre, des lueurs «scintillent». Les rayons «éblouissants» irradient et «illuminent» la salle. L''eau reflète ces «éclats», puis la clarté «faiblit».',
  'rules', jsonb_build_object(
    'scintillent', 'Verbe à la 3e personne du pluriel : « des lueurs »',
    'faiblit', 'Verbe au singulier : « la clarté »',
    'éblouissants', 'Adjectif accordé avec « Les rayons » : masculin pluriel',
    'illuminent', 'Verbe à la 3e personne du pluriel : « Les rayons »',
    'éclats', 'Nom au pluriel : « ces »'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-4';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Les visiteuses «émerveillées» «admirent» des merveilles «fascinantes». Elles «contemplent» cet enchantement envoûtant et «s''extasient» profondément. Quel éblouissement !',
  'rules', jsonb_build_object(
    'émerveillées', 'Adjectif au féminin pluriel : « Les visiteuses »',
    'admirent', 'Verbe à la 3e personne du pluriel : « Les visiteuses »',
    'fascinantes', 'Adjectif accordé avec « des merveilles » : féminin pluriel',
    'contemplent', 'Verbe à la 3e personne du pluriel : « Elles »',
    's''extasient', 'Verbe à la 3e personne du pluriel : « Elles »'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-5';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Les élèves «déterminés» «entreprennent» un travail. Ils «s''efforcent» inlassablement : leur courage «tenace» impose des efforts «opiniâtres». La persévérance gagne résolument.',
  'rules', jsonb_build_object(
    'déterminés', 'Adjectif accordé avec « Les élèves » : masculin pluriel',
    'entreprennent', 'Verbe à la 3e personne du pluriel : « Les élèves »',
    's''efforcent', 'Verbe à la 3e personne du pluriel : « Ils »',
    'tenace', 'Adjectif accordé avec « leur courage » : singulier, pas de -s',
    'opiniâtres', 'Adjectif accordé avec « des efforts » : masculin pluriel'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-6';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Le chemin serpente et «s''élève». Des falaises «abruptes» «surplombent» les versants «escarpés». Les sommets «culminent» majestueusement.',
  'rules', jsonb_build_object(
    's''élève', 'Verbe au singulier : « Le chemin »',
    'abruptes', 'Adjectif accordé avec « Des falaises » : féminin pluriel',
    'surplombent', 'Verbe à la 3e personne du pluriel : « Des falaises »',
    'escarpés', 'Adjectif accordé avec « les versants » : masculin pluriel',
    'culminent', 'Verbe à la 3e personne du pluriel : « Les sommets »'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-7';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Des silhouettes «étranges» «surgissent» mystérieusement. Ces apparitions «énigmatiques» disparaissent, «insaisissables». Le détective décèle un indice et «dévoile» la vérité.',
  'rules', jsonb_build_object(
    'étranges', 'Adjectif accordé avec « Des silhouettes » : pluriel',
    'surgissent', 'Verbe à la 3e personne du pluriel : « Des silhouettes »',
    'énigmatiques', 'Adjectif accordé avec « Ces apparitions » : pluriel',
    'insaisissables', 'Adjectif accordé avec « Ces apparitions » : féminin pluriel',
    'dévoile', 'Verbe au singulier : « Le détective »'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-8';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Les traîtres «fourbes» «manigancent» astucieusement. Ils «feignent» la peur, dissimulent leur malice et leurrent la garde. Quels «stratagèmes» «sournois», quelle perfidie !',
  'rules', jsonb_build_object(
    'fourbes', 'Adjectif accordé avec « Les traîtres » : pluriel',
    'manigancent', 'Verbe à la 3e personne du pluriel : « Les traîtres »',
    'feignent', 'Verbe à la 3e personne du pluriel : « Ils »',
    'stratagèmes', 'Nom au pluriel : « Quels »',
    'sournois', 'Adjectif au masculin pluriel : se termine déjà par -s, invariable'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-9';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Autrefois, les grands-mères se «souvenaient» et se rappelaient des soirées «mémorables». Elles «évoquaient» ces fêtes «inoubliables». Leur mémoire, jamais «oublieuse», gardait la nostalgie.',
  'rules', jsonb_build_object(
    'souvenaient', 'Verbe à la 3e personne du pluriel : « les grands-mères »',
    'mémorables', 'Adjectif accordé avec « des soirées » : pluriel',
    'évoquaient', 'Verbe à la 3e personne du pluriel : « Elles »',
    'inoubliables', 'Adjectif accordé avec « ces fêtes » : pluriel',
    'oublieuse', 'Adjectif accordé avec « Leur mémoire » : féminin singulier'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-10';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Les infirmières «indulgentes» «encouragent» et «réconfortent» les blessés. Elles «rassurent» généreusement, avec bienveillance. Leur altruisme «clément» et charitable montre une vraie magnanimité.',
  'rules', jsonb_build_object(
    'indulgentes', 'Adjectif au féminin pluriel : « Les infirmières »',
    'encouragent', 'Verbe à la 3e personne du pluriel : « Les infirmières »',
    'réconfortent', 'Verbe à la 3e personne du pluriel : « Les infirmières »',
    'rassurent', 'Verbe à la 3e personne du pluriel : « Elles »',
    'clément', 'Adjectif accordé avec « Leur altruisme » : masculin singulier'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-11';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Des cris «éclatent» bruyamment. Le tonnerre «gronde», le fracas «retentit» et les murs «résonnent». Quel tumulte «assourdissant», quel vacarme, quel tapage !',
  'rules', jsonb_build_object(
    'éclatent', 'Verbe à la 3e personne du pluriel : « Des cris »',
    'gronde', 'Verbe au singulier : « Le tonnerre »',
    'retentit', 'Verbe au singulier : « le fracas »',
    'résonnent', 'Verbe à la 3e personne du pluriel : « les murs »',
    'assourdissant', 'Adjectif accordé avec « Quel tumulte » : masculin singulier'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-12';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Le maître «irascible» «s''emporte» furieusement. «Exaspéré», il fulmine et enrage. Sa hargne et son courroux «nourrissent» l''animosité : les élèves «s''irritent».',
  'rules', jsonb_build_object(
    'irascible', 'Adjectif accordé avec « Le maître » : singulier',
    's''emporte', 'Verbe au singulier : « Le maître »',
    'Exaspéré', 'Adjectif accordé avec « il » : masculin singulier',
    'nourrissent', 'Verbe au pluriel : deux sujets, « Sa hargne et son courroux »',
    's''irritent', 'Verbe à la 3e personne du pluriel : « les élèves »'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-13';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Les professeurs «avertis» «enseignent» savamment. Leurs leçons «éclairées» transmettent des «connaissances». Les élèves «studieux» assimilent cette érudition.',
  'rules', jsonb_build_object(
    'avertis', 'Adjectif accordé avec « Les professeurs » : masculin pluriel',
    'enseignent', 'Verbe à la 3e personne du pluriel : « Les professeurs »',
    'éclairées', 'Adjectif accordé avec « Leurs leçons » : féminin pluriel',
    'connaissances', 'Nom au pluriel : « des »',
    'studieux', 'Adjectif au masculin pluriel : se termine déjà par -x, invariable'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-14';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'La directrice «avisée» «s''assure» d''un examen clairvoyant. Ses raisonnements «réfléchis» mènent à des choix «judicieux». «Convaincue», elle garde sa lucidité.',
  'rules', jsonb_build_object(
    'avisée', 'Adjectif accordé avec « La directrice » : féminin singulier',
    's''assure', 'Verbe au singulier : « La directrice »',
    'réfléchis', 'Adjectif accordé avec « Ses raisonnements » : masculin pluriel',
    'judicieux', 'Adjectif au masculin pluriel : se termine déjà par -x, invariable',
    'Convaincue', 'Adjectif accordé avec « elle » : féminin singulier'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-15';

UPDATE dictees SET training_text = jsonb_build_object(
  'marked', 'Des paroles «paisibles» «apaisent», adoucissent et soulagent. Elles «modèrent» les colères, pacifient les esprits «sereins». Cette consolation «rend» la tranquillité, la quiétude.',
  'rules', jsonb_build_object(
    'paisibles', 'Adjectif accordé avec « Des paroles » : féminin pluriel',
    'apaisent', 'Verbe à la 3e personne du pluriel : « Des paroles »',
    'modèrent', 'Verbe à la 3e personne du pluriel : « Elles »',
    'sereins', 'Adjectif accordé avec « les esprits » : masculin pluriel',
    'rend', 'Verbe au singulier : « Cette consolation »'
  ),
  'validated', true,
  'audio_url', training_text->>'audio_url',
  'updated_at', now()
) WHERE id = 'dictee-5e-16';

SELECT id, training_text->>'marked' AS texte FROM dictees WHERE level = '5e' ORDER BY position;