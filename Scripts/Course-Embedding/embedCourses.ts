import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { QdrantClient } from "@qdrant/js-client-rest";
// To use this, you need to have a docker container running on port http://localhost:6333'
// To do this, either download the image Jake shared
//Or build your own with `docker run -p 6333:6333 -p 6334:6334 \
  //-v $(pwd)/qdrant_storage:/qdrant/storage:z \
  //qdrant/qdrant`
// Now set the env variable QDRANT_URL to http://localhost:6333
// Qdrant API key is unnescissary because we are hosting it locally for now
// You do need to set a different geminai api key than what is used for general
// chat messages. The new one is used for encoding. You cannot use the free tier, it is $0.15/1M tokens (very cheap)
// You set this as Key:
// ---------- CONFIG ----------
const COURSES_PATH = "./data/courses.json";
const COLLECTION_NAME = "courses";
const EMBEDDING_DIM = 768;

// ---------- CLIENTS ----------
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

// ---------- HELPERS ----------
function courseToEmbeddingText(course: any): string {
  return `
Course: ${course.subject} (${course.number})
Long Title: ${course.longTitle}
Department: ${course.prefixTitle}
Description:
${course.description}
`.trim();
}

// ---------- MAIN ----------
async function run() {
  const courses = JSON.parse(
    fs.readFileSync(COURSES_PATH, "utf8")
  );

  // Create collection (safe to re-run)
  await qdrant
    .createCollection(COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_DIM,
        distance: "Cosine",
      },
  }).catch(() => {});

  for (const course of courses) {
    const text = courseToEmbeddingText(course);

    const embeddingRes = await genAI.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });

    const vector = embeddingRes.embeddings?.[0]?.values;

    if (!vector || vector.length !== EMBEDDING_DIM) {
      throw new Error(`Invalid embedding dimension: expected ${EMBEDDING_DIM}, got ${vector?.length || 0}`);
    }

    // sanity check
    //console.log(vector.length); // should be 768

    await qdrant.upsert(COLLECTION_NAME, {
      points: [
        {
          id: course.course_id,
          vector,
          payload: {
            subject: course.subject,
            prefixTitle: course.prefixTitle,
            prefixDescription: course.prefixDescription,
            number: course.number,
            longTitle: course.longTitle,
            shortTitle: course.shortTitle,
            creditsPhrase: course.creditsPhrase,
            requisitePhrase: course.requisitePhrase,
            description: course.description,
            typicallyOffered: course.typicallyOffered,
            course_id: course.course_id,
          },
        },
      ],
    });
  }

  console.log("✅ All courses embedded");
}

run().catch(err => {
  console.error("❌ Embedding failed:", err);
  process.exit(1);
});
