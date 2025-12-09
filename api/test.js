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
    // --- 2. FETCH BASIC LEVEL DATA ---
    const levelRes = await fetch(`https://gdbrowser.com/api/level/${id}`);
    
    if (!levelRes.ok) {
      return res.status(levelRes.status).json({ error: 'Level not found or GDBrowser error' });
    }

    const levelData = await levelRes.json();
    const authorName = levelData.author;
    
    // Define the potential thumbnail URL
    const targetThumbUrl = `https://levelthumbs.prevter.me/thumbnail/${id}/high`;

    // --- 3. PREPARE PARALLEL REQUESTS ---
    const requests = [
      // A. Fetch Author Profile
      fetch(`https://gdbrowser.com/api/profile/${authorName}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),

      // B. Fetch Top Comments (First Page)
      fetch(`https://gdbrowser.com/api/comments/${id}?count=20`)
        .then(r => r.ok ? r.json() : []).catch(() => []),

      // C. Check if Thumbnail Exists (HEAD request is faster, doesn't download the image)
      fetch(targetThumbUrl, { method: 'HEAD' })
        .then(r => r.ok ? targetThumbUrl : null).catch(() => null)
    ];

    // Wait for all data to arrive
    const [authorData, commentsData, verifiedThumbnail] = await Promise.all(requests);

    // --- 4. GENERATE SONG LINK ---
    let songUrl = null;
    if (levelData.customSong >= 1) {
      if (levelData.songLink) {
        songUrl = decodeURIComponent(levelData.songLink);
      } else {
        songUrl = `https://www.newgrounds.com/audio/listen/${levelData.songID}`;
      }
    }

    // --- 5. CONSTRUCT RESPONSE ---
    const fullResponse = {
      // Standard level data
      ...levelData,

      // Extras
      extras: {
        // This will be the URL if found, or null if not found
        thumbnail_url: verifiedThumbnail, 
        song_url: songUrl,
        level_url: `https://gdbrowser.com/${id}`,
      },

      // Extended info (Leaderboard removed)
      extended_info: {
        author_profile: authorData || { error: "Profile not found" },
        comments: commentsData
      }
    };

    return res.status(200).json(fullResponse);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
