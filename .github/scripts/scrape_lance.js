const axios = require("axios");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const LANCE_SOURCE_ID = process.env.LANCE_SOURCE_ID;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !LANCE_SOURCE_ID) {
    console.error("Faltam variáveis de ambiente.");
    process.exit(1);
  }

  try {
    const apiUrl = "https://content-api-lance.com.br/api/v1/posts?team=flamengo&page=1";

    const resp = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      validateStatus: () => true,
    });

    console.log("Status HTTP Lance API:", resp.status);

    if (resp.status >= 400 || !resp.data?.data) {
      console.log("Erro ao acessar API do Lance.");
      return;
    }

    const posts = resp.data.data;
    console.log("Posts encontrados:", posts.length);

    for (const post of posts.slice(0, 30)) {
      const title = post.title?.trim();
      const url = `https://www.lance.com.br/${post.slug}`;
      const image = post?.featured_media?.url || null;

      try {
        const res = await axios.post(
          `${SUPABASE_URL}/rest/v1/pending_articles`,
          {
            source_id: LANCE_SOURCE_ID,
            title,
            url,
            image_url: image,
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

        console.log("Inserido:", title, "status:", res.status);
      } catch (err) {
        console.error(
          "Erro ao inserir no Supabase:",
          url,
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
