const { execSync } = require('child_process');

const SUPABASE_URL = "https://agmxqdcnmfprnuktpmjq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbXhxZGNubWZwcm51a3RwbWpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI3MTEzNywiZXhwIjoyMDg4ODQ3MTM3fQ.cRGAlMqDXzSB6ekStaG8przTGCvNFanFMB43E8tl8Qs";

async function backfillCommits() {
  console.log("Fetching local Git history for the last 30 days from signos-live...");
  try {
    const gitOutput = execSync('git log --since="30 days ago" --pretty=format:"%H|%cI|%an|%s"').toString();
    if (!gitOutput) return console.log("No commits found.");
    
    const commits = gitOutput.split('\n');
    console.log(`Found ${commits.length} commits. Uploading to Supabase...`);

    for (const line of commits) {
      const [hash, date, author, ...msgParts] = line.split('|');
      const message = msgParts.join('|').replace(/"/g, '\\"'); 

      const payload = {
        author: author,
        commit_hash: hash,
        message: message,
        files_changed: "1", 
        github_link: `https://github.com/SignStoreERP/signos-live/commit/${hash}`,
        environment: "LIVE", // Tagged as Production
        timestamp: date
      };

      await fetch(`${SUPABASE_URL}/rest/v1/sys_changelog`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      console.log(`✅ Logged LIVE: ${hash.substring(0,7)}`);
    }
    console.log("🎉 signos-live backfill complete!");
  } catch (error) {
    console.error("Error:", error.message);
  }
}
backfillCommits();