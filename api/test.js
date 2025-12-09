export default async function handler(req, res) {
  // --- 1. CONFIGURATION & HEADERS ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Level ID is required.' });
  }

  try {
    const targetThumbUrl = `https://levelthumbs.prevter.me/thumbnail/${id}/high`;

    // --- 2. PARALLEL FETCHING ---
    const [levelRes, thumbRes] = await Promise.all([
      fetch(`https://gdbrowser.com/api/level/${id}`),
      fetch(targetThumbUrl, { method: 'HEAD' }).catch(() => null)
    ]);

    // --- 3. VALIDATE LEVEL DATA ---
    if (!levelRes.ok) {
      return res.status(levelRes.status).json({ error: 'Level not found or GDBrowser error' });
    }

    // Get the data object
    const levelData = await levelRes.json();

    // --- 4. REMOVE UNWANTED FIELDS ---
    // This list includes the previous requests plus the new ones
    const keysToRemove = [
      // Batch 1
      "officialSong", 
      "ldm", 
      "partialDiff", 
      "difficultyFace", 
      "epic", 
      "epicValue", 
      "legendary", 
      "mythic", 
      "featured", 
      "featuredPosition",
      // Batch 2 (New)
      "cp",
      "disliked",
      "editorTime",
      "totalEditorTime",
      "gameVersion",
      "copiedID",
      "songSize"
    ];

    keysToRemove.forEach(key => delete levelData[key]);

    // --- 5. VALIDATE THUMBNAIL ---
    const validThumbnail = (thumbRes && thumbRes.ok) ? targetThumbUrl : null;

    // --- 6. GENERATE SONG LINK ---
    let songUrl = null;
    if (levelData.customSong >= 1) {
      if (levelData.songLink) {
        songUrl = decodeURIComponent(levelData.songLink);
      } else {
        songUrl = `https://www.newgrounds.com/audio/listen/${levelData.songID}`;
      }
    }

    // --- 7. CONSTRUCT RESPONSE ---
    const fullResponse = {
      thumbnail: validThumbnail,
      song_url: songUrl,
      ...levelData
    };

    return res.status(200).json(fullResponse);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
