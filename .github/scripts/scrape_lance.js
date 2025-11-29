const axios = require("axios");
const cheerio = require("cheerio");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const LANCE_SOURCE_ID = process.env.LANCE_SOURCE_ID;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !LANCE_SOURCE_ID) {
    console.error("Faltam variáveis de ambiente.");
    process.exit(1);
  }

  try {
    const pageUrl = "https://www.lance.com.br/flamengo";

    const resp = await axios.get(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      validateStatus: () => true,
    });

    console.log("Status HTTP Lance:", resp.status);

    if (resp.status >= 400 || !resp.data) {
      console.log("Não deu pra acessar a página do Lance.");
      return;
    }

    const $ = cheerio.load(resp.data);

    const items = [];
    const seen = new Set();

    // pega todos os links que têm "/flamengo/" na URL
    $("a[href*='/flamengo/']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      const url = href.startsWith("http")
        ? href
        : `https://www.lance.com.br${href}`;

      if (seen.has(url)) return;
      seen.add(url);

      const rawTitle = $(el).text().trim();
      if (!rawTitle || rawTitle.length < 8) return;

      // tenta achar imagem no card mais próximo
      let image = null;
      const $card = $(el).closest("article, div");
      const imgSrc =
        $card.find("img").attr("src") || $card.find("img").attr("data-src");
      if (imgSrc) {
        image = imgSrc.startsWith("http")
          ? imgSrc
          : `https://www.lance.com.br${imgSrc}`;
      }

      items.push({ title: rawTitle, url, image });
    });

    console.log("Links encontrados no HTML:", items.length);

    if (items.length === 0) {
      console.log("Nenhum link de Flamengo encontrado.");
      return;
    }

    // insere no Supabase (limite 30)
    for (const item of items.slice(0, 30)) {
      try {
        const res = await axios.post(
          `${SUPABASE_URL}/rest/v1/pending_articles`,
          {
            source_id: LANCE_SOURCE_ID,
            title: item.title,
            url: item.url,
            image_url: item.image || null,
            processed: false,
          },
          {
            headers: {
              apikey: SUPABASE_SERVICE_ROLE,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates",
            },
          }
        );

        console.log(
          "Inserido:",
          item.title.slice(0, 60),
          "- status:",
          res.status
        );
      } catch (err) {
        console.error(
          "Erro ao inserir no Supabase:",
          item.url,
          err.response?.status,
          err.response?.data
        );
      }
    }

    console.log("Scrape Lance finalizado.");
  } catch (err) {
    console.error("Erro geral:", err.message || err);
  }
}

main();
