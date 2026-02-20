// ==========================================
// SignOS API v6.27 - Added Backup Folder for Cost Matrix
// ==========================================

// MASTER 1: The Data Backend (READ/WRITE)
const DATA_SS_ID = "1wiaj5rU5J2kv1SobfyysMFynDOsli4Nb6pDvIf3L9_Y";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1LqSV-byNLOdu_GVyasvFmwyaW8TkyvW4F78u6_gaqzk";

// ARCHIVE: SignOS_Archives Folder
const ARCHIVE_FOLDER_ID = "18MBPWajHdF4TNQ0g8Iz1n1-GT3nBrMj4";

// CONTEXT: SignOS Dev Folder
const CONTEXT_FOLDER_ID = "1Hl5LtIhwt6p3zDeV52kok-8C61_ApXf7"; 

// CONTEXT: admin_cost_matrix.html BACKUP Folder
const BACKUP_FOLDER_ID = "1bvOCt3Cs8U7gGmmFmmMvWJUetxXYV1tU"; 

function doGet(e) {
  const params = e.parameter;
  
  // 1. LOGGING (Async)
  if (params.ip) logActivity(params);

  // --- ROUTING ---

  // 2. Auth & Core Tables
  if (params.req === "auth") return handleAuth(params.pin);
  if (params.req === "table") return fetchTable(params.tab);
  
  // 2b. Matrix Updates & Fetches (New)
  if (params.req === "update_matrix") return updateMatrixValue(params);
  if (params.req === "view_module") return fetchProductWithMatrix(params.tab);
  if (params.req === "commit_matrix") return commitMatrixBatch(params);

  // 3. Roadmap / Ticketing
  if (params.req === "add_roadmap") return addRoadmapItem(params);
  if (params.req === "get_ticket") return getTicketDetails(params.id);
  if (params.req === "add_action") return addTicketAction(params);

  // 4. Archival & Logs (Admin)
  if (params.req === "manual_archive") return manualExport(params.pin);
  if (params.req === "get_archive_index") return fetchArchiveIndex();
  if (params.req === "get_log_content") return fetchLogFile(params.file_id);
  if (params.req === "get_live_logs") return fetchLiveLogs();
  if (params.req === "log_event") return ContentService.createTextOutput("Logged");

  // 5. System Utils
  if (params.req === "ping") return ContentService.createTextOutput("pong");
  if (params.req === "sync_versions") return syncVersionsFromGitHub();
  
  // 6. NotebookLM Bridge
  if (params.req === "sync_codebase") return generateNotebookLMBridge();

  // 7. DEFAULT: Matrix Config Fetch (Fallthrough)
  return fetchProductWithMatrix(params.tab || "PROD_Yard_Signs");
}

// ==========================================
//  CORE DATA FUNCTIONS
// ==========================================

function handleAuth(pin) {
  const sheet = SpreadsheetApp.openById(DATA_SS_ID).getSheetByName("Master_Staff");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][6]) === String(pin)) { // Col G
      const isActive = (data[i][7] === true || String(data[i][7]).toUpperCase() === "TRUE");
      if (!isActive) return returnJSON({ status: "fail", message: "Account Disabled" });

      return returnJSON({
        status: "success",
        name: data[i][1], 
        role: data[i][5], 
        permissions: {
          roadmap: data[i][8] || "None",
          backup: data[i][9] || "None"
        }
      });
    }
  }
  return returnJSON({ status: "fail", message: "Invalid PIN" });
}

function fetchTable(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });
    
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return returnJSON([]);
    
    // FIX v6.22: Select row 0 specifically for headers
    const headers = values[0]; 
    const rows = values.slice(1);
    
    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        if(header && String(header).trim() !== "") obj[header] = row[index];
      });
      return obj;
    });
    return returnJSON(result);
  } catch (err) { return returnJSON({ error: err.toString() }); }
}

function fetchConfig(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return returnJSON({});
    
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const config = {};
    
    data.forEach(row => {
      const key = row[0];
      const val = row[1];
      if (key && String(key).trim() !== "") config[key] = val;
    });
    
    return returnJSON(config);
  } catch (err) { return returnJSON({ error: err.toString() }); }
}

// ==========================================
//  ROADMAP & TICKETING
// ==========================================

function addRoadmapItem(p) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Roadmap");
  const id = "RMP_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm");
  
  sheet.appendRow([
    id, new Date(), p.user, p.cat, p.prio || "Med",
    decodeURIComponent(p.title), decodeURIComponent(p.desc),
    "Pending", p.target || "APP", p.source || "User", p.context || "General"
  ]);
  return returnJSON({ status: "success", id: id });
}

function getTicketDetails(ticketId) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const pSheet = ss.getSheetByName("SYS_Roadmap");
    const cSheet = ss.getSheetByName("SYS_Roadmap_Actions");
    
    const pData = pSheet.getDataRange().getValues();
    // FIX v6.22: Select row 0 for headers
    const pHeaders = pData[0];
    let ticket = null;
    
    for(let i=1; i<pData.length; i++) {
      if(String(pData[i][0]) === String(ticketId)) {
        ticket = {};
        pHeaders.forEach((h, idx) => ticket[h] = pData[i][idx]);
        break;
      }
    }
    
    if(!ticket) return returnJSON({ status: "error", message: "Ticket not found" });
    
    const cData = cSheet.getDataRange().getValues();
    // FIX v6.22: Select row 0 for headers
    const cHeaders = cData[0];
    const history = [];
    
    for(let i=1; i<cData.length; i++) {
      if(String(cData[i][1]) === String(ticketId)) {
        let act = {};
        cHeaders.forEach((h, idx) => act[h] = cData[i][idx]);
        history.push(act);
      }
    }
    history.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    
    return returnJSON({ status: "success", ticket: ticket, history: history });
    
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function addTicketAction(p) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Roadmap_Actions");
  const actId = "ACT_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  
  sheet.appendRow([actId, p.id, new Date(), p.user, p.type, decodeURIComponent(p.msg)]);
  
  if(p.new_status) {
    const pSheet = ss.getSheetByName("SYS_Roadmap");
    const pData = pSheet.getDataRange().getValues();
    for(let i=1; i<pData.length; i++) {
      if(String(pData[i][0]) === String(p.id)) {
        pSheet.getRange(i+1, 8).setValue(p.new_status);
        break;
      }
    }
  }
  return returnJSON({ status: "success" });
}

// ==========================================
//  ARCHIVE & LOGGING
// ==========================================

function fetchArchiveIndex() {
  const ss = SpreadsheetApp.openById(LOG_SS_ID);
  const sheet = ss.getSheetByName("SYS_Archive_Index");
  if (!sheet) return returnJSON([]);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return returnJSON([]);
  
  const result = data.slice(1).map(r => {
    let fileId = null;
    if (r[2] && r[2].includes("/d/")) {
        const match = r[2].match(/\/d\/(.+?)\//);
        if(match) fileId = match[1];
    }
    return { date: r[0], name: r[1], url: r[2], count: r[3], type: r[4], file_id: fileId };
  }).reverse();
  return returnJSON(result);
}

function fetchLogFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    return returnJSON({ status: "success", content: file.getBlob().getDataAsString() });
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function fetchLiveLogs() {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    if (!sheet) return returnJSON({ status: "error", message: "Log sheet not found" });
    
    // RETURN RAW DATA (Fix for logic_viewer.js)
    // We return the entire grid (Array of Arrays) so the frontend can slice/map it by index.
    const data = sheet.getDataRange().getValues();
    
    return returnJSON({ status: "success", logs: data });
    
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function logActivity(p) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    sheet.appendRow([new Date(), p.ip || "Unknown", p.user || "GUEST", p.role || "N/A", p.req, p.tab || "N/A", JSON.stringify(p)]);
  } catch (e) {}
}

function manualExport(pin) {
  const auth = handleAuth(pin);
  const authObj = JSON.parse(auth.getContent());
  if (authObj.status !== "success") return returnJSON({ status: "error", message: "Unauthorized" });
  
  return returnJSON(processArchive(false));
}

function processArchive(isDestructive) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const logSheet = ss.getSheetByName("SYS_Access_Logs");
    const lastRow = logSheet.getLastRow();
    if (lastRow < 2) return { status: "skipped" };
    
    const data = logSheet.getRange(2, 1, lastRow - 1, logSheet.getLastColumn()).getValues();
    let content = "Timestamp | IP | User | Role | Action | Target | Meta\n=================================================\n";
    data.forEach(r => content += r.join(" | ") + "\n");
    
    const name = `SignOS_Log_${isDestructive ? 'AUTO' : 'MANUAL'}_${Date.now()}.txt`;
    const folder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
    const file = folder.createFile(name, content);
    
    const idxSheet = ss.getSheetByName("SYS_Archive_Index");
    idxSheet.appendRow([new Date(), name, file.getUrl(), data.length, isDestructive ? "AUTO" : "MANUAL"]);
    
    if (isDestructive) logSheet.deleteRows(2, lastRow - 1);
    
    return { status: "success", url: file.getUrl(), rows_archived: data.length };
  } catch(e) { return { status: "error", message: e.toString() }; }
}

// ==========================================
//  NOTEBOOKLM BRIDGE
// ==========================================

function generateNotebookLMBridge() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");
  const data = sheet.getDataRange().getValues();
  
  let fullContent = "# SIGNOS ERP - MASTER CODEBASE CONTEXT\n";
  fullContent += `**Last Sync:** ${new Date().toString()}\n`;
  fullContent += "---\n\n";

  const repoOwner = "SignStoreERP";
  const repoName = "signos-app"; 
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const name = data[i][1]; 
    const fileName = data[i][2]; 
    
    if (fileName && (fileName.toString().endsWith(".html") || fileName.toString().endsWith(".js"))) {
      try {
        const url = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${fileName}`;
        const content = UrlFetchApp.fetch(url).getContentText();
        const ext = fileName.split('.').pop();
        const lang = ext === 'js' ? 'javascript' : 'html';

        fullContent += `## ${name} (${fileName})\n> Source: ${url}\n\n`;
        fullContent += "```" + lang + "\n" + content + "\n```\n\n---\n\n";
        count++;
      } catch (e) {}
    }
  }
  
  const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);
  const targetName = "SignOS_DEV_Context.txt";
  const files = folder.getFilesByName(targetName);
  let fileUrl = "";

  if (files.hasNext()) {
    const file = files.next();
    file.setContent(fullContent);
    fileUrl = file.getUrl();
  } else {
    const file = folder.createFile(targetName, fullContent, MimeType.PLAIN_TEXT);
    fileUrl = file.getUrl();
  }
  
  return returnJSON({ status: "success", message: `Synced ${count} modules.`, url: fileUrl });
}

// ==========================================
//  UTILITIES & WEBHOOK
// ==========================================

function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function syncVersionsFromGitHub() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");
  const data = sheet.getDataRange().getValues();
  
  const repoOwner = "SignStoreERP";
  const devRepo = "signos-app";
  const liveRepo = "signos-live";
  
  for (let i = 1; i < data.length; i++) {
    const fileName = data[i][2]; 
    if (fileName && fileName.toString().endsWith(".html")) {
      try {
        const devUrl = `https://raw.githubusercontent.com/${repoOwner}/${devRepo}/main/${fileName}`;
        const devHtml = UrlFetchApp.fetch(devUrl).getContentText();
        const devMatch = devHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (devMatch && devMatch[1]) {
          sheet.getRange(i + 1, 5).setValue(devMatch[1]); 
        }
      } catch (e) {}

      try {
        const liveUrl = `https://raw.githubusercontent.com/${repoOwner}/${liveRepo}/main/${fileName}`;
        const liveHtml = UrlFetchApp.fetch(liveUrl).getContentText();
        const liveMatch = liveHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (liveMatch && liveMatch[1]) {
          sheet.getRange(i + 1, 4).setValue(liveMatch[1]); 
        }
      } catch (e) {}
    }
  }
} // <--- THIS BRACKET WAS MISSING

// ==========================================
//  COST MATRIX LOGIC
// ==========================================

function updateMatrixValue(p) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Cost_Matrix");
    
    // 1. Get Headers and IDs to find coordinates
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues(); // Product IDs
    const rowIds = sheet.getRange(1, 1, lastRow, 1).getValues().flat(); // Cost IDs
    
    // 2. Find Coordinates
    const colIndex = headers.indexOf(p.product_id); // Returns -1 if not found
    const rowIndex = rowIds.indexOf(p.cost_id);     // Returns -1 if not found
    
    if (colIndex === -1) return returnJSON({ status: "error", message: "Product ID not found" });
    if (rowIndex === -1) return returnJSON({ status: "error", message: "Cost ID not found" });
    
    // 3. Determine Value Type (Boolean or Number)
    let val = p.value;
    if (val === 'TRUE') val = true;
    else if (val === 'FALSE') val = false;
    else if (!isNaN(parseFloat(val))) val = parseFloat(val);
    
    // 4. Update Cell (Adding 1 because array index is 0-based, sheet is 1-based)
    sheet.getRange(rowIndex + 1, colIndex + 1).setValue(val);
    
    // 5. Log the Change (Audit Trail)
    logActivity({
      user: p.user,
      action: "MATRIX_UPDATE",
      target: `${p.product_id} -> ${p.cost_id}`,
      meta: `Changed to ${val}`,
      req: "update_matrix"
    });
    
    return returnJSON({ status: "success", new_value: val });
    
  } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (!payload.commits) return returnJSON({status: "ignored"});
    
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const logSheet = ss.getSheetByName("SYS_Changelog");
    
    const repoName = payload.repository.name.toLowerCase();
    const envTag = (repoName.includes("live") || repoName.includes("prod")) ? "LIVE" : "DEV";

    payload.commits.forEach(c => {
      const ts = new Date(c.timestamp);
      logSheet.appendRow([ts, c.author.name, c.id.substring(0, 7), c.message, c.added.length+c.modified.length, c.url, envTag]);
    });
    
    syncVersionsFromGitHub(); 
    return returnJSON({ status: "success" });
  } catch(e) { return returnJSON({ status: "error" }); }
}

// ==========================================
//  MATRIX INTEGRATION ENGINE (v7.0)
// ==========================================

function fetchProductWithMatrix(tabName) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  
  // 1. Fetch Standard Product Data (Legacy Support)
  let config = {};
  try {
    const prodSheet = ss.getSheetByName(tabName);
    if (prodSheet) {
      const data = prodSheet.getDataRange().getValues();
      // Skip header, map Key (Col A) to Value (Col B)
      for (let i = 1; i < data.length; i++) {
        const key = data[i][0]; // FIX: Select Col A
        const val = data[i][1]; // Select Col B
        if (key) config[key] = val;
      }
    }
  } catch(e) { console.warn("Legacy fetch failed: " + e); }

  // 2. Fetch Matrix Overrides
  try {
    const matrixSheet = ss.getSheetByName("SYS_Cost_Matrix");
    const defSheet = ss.getSheetByName("REF_Cost_Definitions");
    
    if (matrixSheet && defSheet) {
      // Get Data
      const mData = matrixSheet.getDataRange().getValues();
      const dData = defSheet.getDataRange().getValues();
      
      // Find Column for this Product
      // Logic: "PROD_Yard_Signs" -> "PROD_Yard"
      const productID = tabName.replace("_Signs", "").replace("_Calculator", ""); 
      const headers = mData[0]; // FIX: Select just the header row
      const colIdx = headers.findIndex(h => h === productID || h === tabName);
      
      if (colIdx > -1) {
        // Create Dictionary of Definitions (Row ID -> Default Value)
        const defMap = {};
        for (let i = 1; i < dData.length; i++) {
          // Key: Col A (Cost_ID), Value: Col F (Default_Source_Ref)
          // FIX: Select Col A [0] and Col F [5]
          if(dData[i][0]) defMap[dData[i][0]] = dData[i][5]; 
        }

        // Loop Matrix Rows and Apply Logic
        for (let r = 1; r < mData.length; r++) {
          const costKey = mData[r][0];      // FIX: Select Col A (Cost Key)
          const matrixVal = mData[r][colIdx]; // TRUE, FALSE, or Override
          
          if (matrixVal === false || String(matrixVal).toUpperCase() === "FALSE") {
            config[costKey] = 0; // Hard disable
          } else if (matrixVal === true || String(matrixVal).toUpperCase() === "TRUE") {
            config[costKey] = defMap[costKey]; // Use Global Default
          } else if (matrixVal !== "" && !isNaN(parseFloat(matrixVal))) {
            config[costKey] = matrixVal; // Use Override
          }
        }
      }
    }
  } catch(e) { 
    return returnJSON({ error: "Matrix Logic Failed: " + e.toString() }); 
  }

  return returnJSON(config);
}

// ==========================================
//  MATRIX BATCH ENGINE (Stage & Commit)
// ==========================================

function commitMatrixBatch(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Prevent collision
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Cost_Matrix");
    
    // 1. CREATE BACKUP (Safety Net)
    // We dump the current values before changing anything
    const currentData = sheet.getDataRange().getValues();
    const backupName = `BACKUP_Matrix_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    
    // FIX: Use your existing ARCHIVE_FOLDER_ID
    const backupFolder = DriveApp.getFolderById(BACKUP_FOLDER_ID); 
    backupFolder.createFile(backupName, JSON.stringify(currentData), MimeType.PLAIN_TEXT);

    // 2. PARSE & APPLY UPDATES
    const updates = JSON.parse(p.payload);
    
    // FIX: Select [0] to get the 1D list of headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const costIds = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();

    let successCount = 0;

    updates.forEach(change => {
      const colIndex = headers.indexOf(change.product);
      const rowIndex = costIds.indexOf(change.cost);
      
      // Only update if valid coordinates found
      if (colIndex > -1 && rowIndex > -1) {
        let val = change.value;
        // Normalize Booleans
        if (val === 'TRUE') val = true;
        if (val === 'FALSE') val = false;
        
        // Sheet is 1-indexed, Array is 0-indexed -> Add 1
        sheet.getRange(rowIndex + 1, colIndex + 1).setValue(val);
        successCount++;
      }
    });

    // 3. LOG ACTIVITY
    logActivity({
      user: p.user,
      action: "MATRIX_COMMIT",
      target: "SYS_Cost_Matrix",
      meta: `Batch Updated ${successCount} records. Backup: ${backupName}`,
      req: "commit_matrix"
    });

    return returnJSON({ status: "success", backup: backupName, count: successCount });

  } catch (e) {
    return returnJSON({ status: "error", message: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// AUTOMATION WRAPPERS (For Time-Driven Triggers)
// ==========================================

function archiveDailyLogs() {
  // Simulates a SuperUser API request so the trigger can run in the background
  try {
    manualExport({ 
      user: "SYSTEM_AUTO", 
      role: "SUPER", 
      ip: "Background_Trigger" 
    });
    console.log("Auto-Archive Successful");
  } catch(e) {
    console.error("Auto-Archive Failed: " + e.message);
  }
}
