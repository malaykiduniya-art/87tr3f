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
    // We fetch this first because we need the 'author' name for the next step
    const levelRes = await fetch(`https://gdbrowser.com/api/level/${id}`);
    
    if (!levelRes.ok) {
      return res.status(levelRes.status).json({ error: 'Level not found or GDBrowser error' });
    }

    const levelData = await levelRes.json();
    const authorName = levelData.author;

    // --- 3. PREPARE PARALLEL REQUESTS ---
    // We define promises to fetch everything else simultaneously.
    // We use .catch(() => null) so if one fails (e.g., no comments), the whole request doesn't fail.

    const requests = [
      // A. Fetch Author Profile
      fetch(`https://gdbrowser.com/api/profile/${authorName}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),

      // B. Fetch Level Leaderboard (Top 100)
      fetch(`https://gdbrowser.com/api/leaderboardLevel/${id}`)
        .then(r => r.ok ? r.json() : []).catch(() => []),

      // C. Fetch Top Comments (First Page)
      fetch(`https://gdbrowser.com/api/comments/${id}?count=20`)
        .then(r => r.ok ? r.json() : []).catch(() => [])
    ];

    // Wait for all data to arrive
    const [authorData, leaderboardData, commentsData] = await Promise.all(requests);

    // --- 4. GENERATE EXTRA LINKS ---
    
    // Thumbnail
    const thumbnailUrl = `https://levelthumbs.prevter.me/thumbnail/${id}/high`;

    // Song URL (Direct download link)
    let songUrl = null;
    if (levelData.customSong >= 1) {
      // Decode the URL if GDBrowser provided it, otherwise construct Newgrounds link
      if (levelData.songLink) {
        songUrl = decodeURIComponent(levelData.songLink);
      } else {
        songUrl = `https://www.newgrounds.com/audio/listen/${levelData.songID}`;
      }
    }

    // --- 5. CONSTRUCT THE MASSIVE JSON RESPONSE ---
    const fullResponse = {
      // Spread the original level data at the top level
      ...levelData,

      // Add our calculated extras
      extras: {
        thumbnail_url: thumbnailUrl,
        song_url: songUrl,
        level_url: `https://gdbrowser.com/${id}`,
      },

      // Add the enriched fetched data
      extended_info: {
        author_profile: authorData || { error: "Profile not found" },
        leaderboard: leaderboardData, // Array of players
        comments: commentsData        // Array of comments
      }
    };

    return res.status(200).json(fullResponse);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
