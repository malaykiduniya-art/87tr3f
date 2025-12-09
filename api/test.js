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
    // Fetch Level Data and check Thumbnail existence simultaneously
    const [levelRes, thumbRes] = await Promise.all([
      fetch(`https://gdbrowser.com/api/level/${id}`),
      fetch(targetThumbUrl, { method: 'HEAD' }).catch(() => null)
    ]);

    // --- 3. VALIDATE LEVEL DATA ---
    if (!levelRes.ok) {
      return res.status(levelRes.status).json({ error: 'Level not found or GDBrowser error' });
    }

    const levelData = await levelRes.json();

    // --- 4. VALIDATE THUMBNAIL ---
    // If the thumbnail request was successful (status 200), use the URL. Otherwise null.
    const validThumbnail = (thumbRes && thumbRes.ok) ? targetThumbUrl : null;

    // --- 5. GENERATE SONG LINK ---
    let songUrl = null;
    if (levelData.customSong >= 1) {
      if (levelData.songLink) {
        songUrl = decodeURIComponent(levelData.songLink);
      } else {
        songUrl = `https://www.newgrounds.com/audio/listen/${levelData.songID}`;
      }
    }

    // --- 6. CONSTRUCT RESPONSE ---
    // We define 'thumbnail' first so it appears at the top of the JSON
    const fullResponse = {
      thumbnail: validThumbnail, 
      song_url: songUrl,
      
      // Spread the rest of the GDBrowser data below
      ...levelData
    };

    return res.status(200).json(fullResponse);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
