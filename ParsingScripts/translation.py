"""
sl <-> de translation (NLLB) and lemmatization (spaCy).
Imports are lazy so the parser works without torch if --translate is not used. Needs a GPU.
"""
import time

from constants import *
from utils import get_lang_id

NLLB_LANG_CODES = {"sl": "slv_Latn", "de": "deu_Latn"}
SPACY_MODELS = {"sl": "sl_core_news_md", "de": "de_core_news_md"}


class Translator:

    def __init__(self, model_name="facebook/nllb-200-distilled-1.3B", chunk_size=10, num_beams=3):
        self.model_name = model_name
        self.chunk_size = chunk_size
        self.num_beams = num_beams
        self.tokenizer = None
        self.model = None
        self.device = None
        self.nlp = {}

    def _ensure_model(self):
        if self.model is not None:
            return

        import torch
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[INFO] Loading translation model {self.model_name} on {self.device}")
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name)
        self.model.eval()
        self.model.to(self.device)
        if self.device == "cuda":
            try:
                self.model.half()  # faster
            except Exception:
                print("WARNING: could not convert the translation model to fp16")

    def _ensure_spacy(self, lang):
        if lang not in self.nlp:
            import spacy
            self.nlp[lang] = spacy.load(SPACY_MODELS[lang])
        return self.nlp[lang]

    def translate(self, texts, source_lang, target_lang):
        """Translates a list of strings."""
        if not texts:
            return []
        self._ensure_model()
        import torch

        self.tokenizer.src_lang = NLLB_LANG_CODES[source_lang]
        target_id = get_lang_id(self.tokenizer, NLLB_LANG_CODES[target_lang])

        # sort by length for less padding
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        translations = [None] * len(texts)

        print(f"[INFO] Translating {len(texts)} texts {source_lang} -> {target_lang}")
        with torch.no_grad():
            for start in range(0, len(order), self.chunk_size):
                indices = order[start:start + self.chunk_size]
                chunk = [texts[i] for i in indices]
                encoded = self.tokenizer(chunk, return_tensors="pt", padding=True, truncation=True,
                                         max_length=512).to(self.device)
                generated = self.model.generate(
                    **encoded,
                    forced_bos_token_id=target_id,
                    num_beams=self.num_beams,
                    early_stopping=False,
                    length_penalty=1.3,
                    max_new_tokens=512,
                )
                decoded = self.tokenizer.batch_decode(generated, skip_special_tokens=True)
                for i, text in zip(indices, decoded):
                    translations[i] = text

                if self.device == "cuda":
                    del encoded, generated
                    torch.cuda.empty_cache()

        return translations

    def lemmatize(self, texts, lang, sentence_ids, batch_size=64):
        """Returns words for each text."""
        nlp = self._ensure_spacy(lang)
        results = []
        disable = [c for c in ("parser",) if c in nlp.pipe_names]
        with nlp.select_pipes(disable=disable):
            for doc, sentence_id in zip(nlp.pipe(texts, batch_size=batch_size), sentence_ids):
                words = []
                for i, token in enumerate(doc):
                    words.append({
                        ID: f"{sentence_id}.{i + 1}.({lang})",
                        "type": "pc" if token.is_punct else "w",
                        "lemma": token.lemma_,
                        "text": token.text,
                        # needed to reconstruct the original text
                        "join": "right" if i < len(doc) - 1 and not token.whitespace_ else "natural",
                        "propn": 1 if token.pos_ == "PROPN" else 0,
                    })
                results.append(words)
        return results

    def translate_meeting(self, meeting):
        """Adds translations to all sentences."""
        start = time.time()
        translated = 0

        for source_lang, target_lang in (("de", "sl"), ("sl", "de")):
            sentences = [s for s in meeting[SENTENCES] if s[TRANSLATIONS][0]["lang"] == source_lang]
            if not sentences:
                continue

            texts = [s[TRANSLATIONS][0]["text"] for s in sentences]
            translations = self.translate(texts, source_lang, target_lang)
            lemmatized = self.lemmatize(translations, target_lang, [s[ID] for s in sentences])

            for sentence, text, words in zip(sentences, translations, lemmatized):
                sentence[TRANSLATIONS].append({
                    "lang": target_lang,
                    SPEAKER: sentence[SPEAKER],
                    SPEAKER_ID: sentence.get(SPEAKER_ID),
                    "original": 0,
                    "text": text,
                    "words": words,
                })
            translated += len(sentences)

        print(f"[OK] translate_meeting(): translated {translated} sentences in {time.time() - start:.1f} s")

    def translate_agendas(self, agendas):
        """Translates the agenda if it is only in one language."""
        if len(agendas) != 1 or agendas[0]["lang"] not in NLLB_LANG_CODES:
            return agendas

        source = agendas[0]
        target_lang = "de" if source["lang"] == "sl" else "sl"
        texts = [item["text"] or "" for item in source["items"]]
        translated = self.translate(texts, source["lang"], target_lang)
        agendas.append({
            "lang": target_lang,
            "items": [{"n": item["n"], "text": text} for item, text in zip(source["items"], translated)],
        })
        return agendas
