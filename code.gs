// ==========================================
// SignOS_LIVE API v7.2.6 (PRODUCTION STOREFRONT)
// Features: Yield Bounding Boxes, Auto-Chunking AI Bridge
// ==========================================

// MASTER 1: The Data Backend (READ/WRITE)
const DATA_SS_ID = "1wiaj5rU5J2kv1SobfyysMFynDOsli4Nb6pDvIf3L9_Y";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1LqSV-byNLOdu_GVyasvFmwyaW8TkyvW4F78u6_gaqzk";

// FOLDER IDS
const ARCHIVE_FOLDER_ID = "18MBPWajHdF4TNQ0g8Iz1n1-GT3nBrMj4";
const CONTEXT_FOLDER_ID = "1Hl5LtIhwt6p3zDeV52kok-8C61_ApXf7";
const BACKUP_FOLDER_ID = "1bvOCt3Cs8U7gGmmFmmMvWJUetxXYV1tU";

function doGet(e) {
    const params = e.parameter;

    // 1. LOGGING (Async)
    if (params.ip) logActivity(params);

    // --- ROUTING ---
    // 2. Auth & Core Tables
    if (params.req === "auth") return handleAuth(params.pin);
    if (params.req === "table") return fetchTable(params.tab);

    // 2b. Matrix Updates & Fetches
    if (params.req === "update_matrix") return updateMatrixValue(params);
    if (params.req === "view_module") return fetchProductWithMatrix(params.tab);
    if (params.req === "commit_matrix") return commitMatrixBatch(params);
    if (params.req === "bundle") return fetchProductBundle(params);

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

    // 5. System Utils & Version Control
    if (params.req === "ping") return ContentService.createTextOutput("pong");
    if (params.req === "sync_versions") return syncVersionsFromGitHub();

    // 6. NotebookLM Bridges
    if (params.req === "sync_codebase") return generateNotebookLMBridge();
    if (params.req === "sync_backend") return generateBackendContext();

    // 7. DEFAULT: Matrix Config Fetch
    return fetchProductWithMatrix(params.tab || "PROD_Yard_Signs");
}

// ==========================================
//  CORE DATA & AUTH FUNCTIONS
// ==========================================

function handleAuth(pin) {
    const sheet = SpreadsheetApp.openById(DATA_SS_ID).getSheetByName("Master_Staff");
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        // IMMUNE TO PARSER: Assigns columns 0 through 9 to named variables
        const [staffId, fName, lName, title, deptId, role, accessPin, isActiveCol, rdmpAcc, bckpAcc] = data[i];

        if (String(accessPin) === String(pin)) { 
            const isActive = (isActiveCol === true || String(isActiveCol).toUpperCase() === "TRUE");
            
            if (!isActive) return returnJSON({ status: "fail", message: "Account Disabled" });

            return returnJSON({
                status: "success",
                name: fName,
                role: role,
                permissions: {
                    roadmap: rdmpAcc || "None",
                    backup: bckpAcc || "None"
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

        // IMMUNE TO PARSER: Safely pulls index 0 out as headers
        const [headers] = values; 
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

// ==========================================
//  MATRIX INTEGRATION ENGINE
// ==========================================

function fetchProductWithMatrix(tabName) {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    let config = {};

    // 1. Fetch Standard Product Data
    try {
        const prodSheet = ss.getSheetByName(tabName);
        if (prodSheet) {
            const data = prodSheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                const [key, val] = data[i]; // IMMUNE TO PARSER
                if (key) config[key] = val;
            }
        }
    } catch(e) { console.warn("Legacy fetch failed: " + e); }

    // 2. Fetch Matrix Overrides
    try {
        const matrixSheet = ss.getSheetByName("SYS_Cost_Matrix");
        const defSheet = ss.getSheetByName("REF_Cost_Definitions");
        if (matrixSheet && defSheet) {
            const mData = matrixSheet.getDataRange().getValues();
            const dData = defSheet.getDataRange().getValues();
            const productID = tabName.replace("_Signs", "").replace("_Calculator", "");
            
            const [headers] = mData; // IMMUNE TO PARSER
            const colIdx = headers.findIndex(h => h === productID || h === tabName);

            if (colIdx > -1) {
                const defMap = {};
                for (let i = 1; i < dData.length; i++) {
                    const [defKey, , , , , defVal] = dData[i]; // Skips cols 1-4, grabs Col A & Col F
                    if(defKey) defMap[defKey] = defVal; 
                }
                for (let r = 1; r < mData.length; r++) {
                    const [costKey] = mData[r]; 
                    const matrixVal = mData[r][colIdx]; 

                    if (matrixVal === false || String(matrixVal).toUpperCase() === "FALSE") {
                        config[costKey] = 0; 
                    } else if (matrixVal === true || String(matrixVal).toUpperCase() === "TRUE") {
                        config[costKey] = defMap[costKey]; 
                    } else if (matrixVal !== "" && !isNaN(parseFloat(matrixVal))) {
                        config[costKey] = matrixVal; 
                    }
                }
            }
        }
    } catch(e) { console.warn("Matrix Logic Failed: " + e); }

    // 3. Fetch Master_Retail_Blue_Sheet
    try {
        const blueSheet = ss.getSheetByName("Master_Retail_Blue_Sheet");
        if (blueSheet) {
            const bData = blueSheet.getDataRange().getValues();
            for (let i = 1; i < bData.length; i++) {
                const [key, , , , , p1, p10] = bData[i]; // Skips cols 1-4, grabs A, F, and G
                if (key && typeof key === 'string') {
                    config[`${key}_1`] = p1;  
                    config[`${key}_10`] = p10; 
                }
            }
        }
    } catch(e) { console.warn("Blue Sheet fetch failed: " + e); }

    return returnJSON(config);
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
        const pHeaders = pData;
        let ticket = null;

        for(let i=1; i<pData.length; i++) {
            if(String(pData[i]) === String(ticketId)) {
                ticket = {};
                pHeaders.forEach((h, idx) => ticket[h] = pData[i][idx]);
                break;
            }
        }
        if(!ticket) return returnJSON({ status: "error", message: "Ticket not found" });

        const cData = cSheet.getDataRange().getValues();
        const cHeaders = cData;
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
            if(String(pData[i]) === String(p.id)) {
                pSheet.getRange(i+1, 8).setValue(p.new_status);
                break;
            }
        }
    }
    return returnJSON({ status: "success" });
}

// ==========================================
//  ADMIN LOGS & ARCHIVING
// ==========================================

function fetchArchiveIndex() {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Archive_Index");
    if (!sheet) return returnJSON([]);

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return returnJSON([]);

    const result = data.slice(1).map(r => {
        let fileId = null;
        if (r[12] && r[12].includes("/d/")) {
            const match = r[12].match(/\/d\/(.+?)\//);
            if(match) fileId = match[1];
        }
        return { date: r, name: r[1], url: r[12], count: r[13], type: r[14], file_id: fileId };
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

        const data = sheet.getDataRange().getValues();
        return returnJSON({ status: "success", logs: data });
    } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
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
        const name = `SignOS_LIVE_Log_${isDestructive ? 'AUTO' : 'MANUAL'}_${Date.now()}.txt`;
        const folder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
        const file = folder.createFile(name, content);

        const idxSheet = ss.getSheetByName("SYS_Archive_Index");
        idxSheet.appendRow([new Date(), name, file.getUrl(), data.length, isDestructive ? "AUTO" : "MANUAL"]);

        if (isDestructive) logSheet.deleteRows(2, lastRow - 1);
        return { status: "success", url: file.getUrl(), rows_archived: data.length };
    } catch(e) { return { status: "error", message: e.toString() }; }
}

// ==========================================
//  MATRIX BATCH ENGINE (Stage & Commit)
// ==========================================

function updateMatrixValue(p) {
    try {
        const ss = SpreadsheetApp.openById(DATA_SS_ID);
        const sheet = ss.getSheetByName("SYS_Cost_Matrix");
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();

        const headers = sheet.getRange(1, 1, 1, lastCol).getValues();
        const rowIds = sheet.getRange(1, 1, lastRow, 1).getValues().flat();

        const colIndex = headers.indexOf(p.product_id);
        const rowIndex = rowIds.indexOf(p.cost_id);

        if (colIndex === -1 || rowIndex === -1) throw new Error("Invalid Coordinates");

        let val = p.value;
        if (val === 'TRUE') val = true;
        if (val === 'FALSE') val = false;

        sheet.getRange(rowIndex + 1, colIndex + 1).setValue(val);
        logActivity({ user: p.user, action: "MATRIX_UPDATE", target: `${p.product_id} -> ${p.cost_id}`, meta: `Changed to ${val}`, req: "update_matrix" });
        return returnJSON({ status: "success", new_value: val });
    } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function commitMatrixBatch(p) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        const ss = SpreadsheetApp.openById(DATA_SS_ID);
        const sheet = ss.getSheetByName("SYS_Cost_Matrix");
        
        const currentData = sheet.getDataRange().getValues();
        const backupName = `BACKUP_Matrix_${Date.now()}.json`;
        const backupFolder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
        backupFolder.createFile(backupName, JSON.stringify(currentData), MimeType.PLAIN_TEXT);

        const updates = JSON.parse(p.payload);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
        const costIds = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();
        let successCount = 0;

        updates.forEach(change => {
            const colIndex = headers.indexOf(change.product);
            const rowIndex = costIds.indexOf(change.cost);
            if (colIndex > -1 && rowIndex > -1) {
                let val = change.value;
                if (val === 'TRUE') val = true;
                if (val === 'FALSE') val = false;
                sheet.getRange(rowIndex + 1, colIndex + 1).setValue(val);
                successCount++;
            }
        });
        
        logActivity({ user: p.user, action: "MATRIX_COMMIT", target: "SYS_Cost_Matrix", meta: `Batch Updated ${successCount} records. Backup: ${backupName}`, req: "commit_matrix" });
        return returnJSON({ status: "success", count: successCount });
    } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
    finally { lock.releaseLock(); }
}

// ==========================================
//  NOTEBOOKLM BRIDGES (V2.0)
// ==========================================

function generateNotebookLMBridge() {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Modules");
    const data = sheet.getDataRange().getValues();

    const repoOwner = "SignStoreERP";
    const repoName = "signos-live";

    const MAX_CHARS = 300000;
    let chunks = [];
    let currentContent = `# SIGNOS MASTER CODEBASE (PART 1)\n**Sync:** ${new Date().toString()}\n---\n\n`;
    let count = 0;
    let fetchedJS = new Set();

    for (let i = 1; i < data.length; i++) {
      const name = data[i][5];      // Display Name (Col B)
      const fileName = data[i][6];  // FIX: Changed from 12 to 2 (File Link is Col C)

      if (fileName && (fileName.toString().endsWith(".html") || fileName.toString().endsWith(".js"))) {
            try {
                const url = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${fileName}`;
                const content = UrlFetchApp.fetch(url).getContentText();
                const lang = fileName.endsWith('.js') ? 'javascript' : 'html';

                let block = `## ${name} (${fileName})\n\`\`\`${lang}\n${content}\n\`\`\`\n\n---\n\n`;

                if (currentContent.length + block.length > MAX_CHARS) {
                    chunks.push(currentContent);
                    currentContent = `# SIGNOS MASTER CODEBASE (PART ${chunks.length + 1})\n**Sync:** ${new Date().toString()}\n---\n\n`;
                }
                currentContent += block;
                count++;
                
                // Fetch internal JS scripts if HTML
                if (lang === 'html') {
                    const scriptRegex = /<script src="([^"]+\.js)"><\/script>/g;
                    let match;
                    while ((match = scriptRegex.exec(content)) !== null) {
                        const jsFileName = match[1];
                        if (!jsFileName.startsWith('http') && !fetchedJS.has(jsFileName)) {
                            fetchedJS.add(jsFileName);
                            try {
                                const jsUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${jsFileName}`;
                                const jsContent = UrlFetchApp.fetch(jsUrl).getContentText();
                                let jsBlock = `## Dependency (${jsFileName})\n> Parent: ${fileName}\n\n\`\`\`javascript\n${jsContent}\n\`\`\`\n\n---\n\n`;

                                if (currentContent.length + jsBlock.length > MAX_CHARS) {
                                    chunks.push(currentContent);
                                    currentContent = `# SIGNOS ERP - MASTER CODEBASE CONTEXT (PART ${chunks.length + 1})\n**Last Sync:** ${new Date().toString()}\n---\n\n`;
                                }
                                currentContent += jsBlock;
                                count++;
                            } catch(jsErr) {}
                        }
                    }
                }
            } catch (e) {}
        }
    }
    chunks.push(currentContent);

    const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);
    const oldFiles = folder.getFiles();
    while(oldFiles.hasNext()) {
        const f = oldFiles.next();
        if(f.getName().startsWith("SignOS_DEV_Context_Part_") || f.getName().startsWith("SignOS_LIVE_Context")) f.setTrashed(true);
    }

    chunks.forEach((text, idx) => {
        folder.createFile(`SignOS_LIVE_Context_Part_${idx + 1}.txt`, text, MimeType.PLAIN_TEXT);
    });

    return returnJSON({ status: "success", message: `Synced ${count} files across ${chunks.length} chunks.`, url: folder.getUrl() });
}

function generateBackendContext() {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheets = ss.getSheets();
    
    let context = "SIGNOS ERP - BACKEND DATA CONTEXT\n\n";

    sheets.forEach(s => {
        const name = s.getName();
        if (name.includes("Log") || name.includes("Changelog") || name.includes("Master_Staff")) return;

        const data = s.getDataRange().getValues();
        context += `\nTAB: ${name}\n`;
        data.slice(0, 50).forEach(row => context += `| ${row.join(" | ")} |\n`);
    });

    const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);
    const fileName = "SignOS_LIVE_Backend_Context.txt";
    const files = folder.getFilesByName(fileName);

    while (files.hasNext()) files.next().setTrashed(true);
    const file = folder.createFile(fileName, context, MimeType.PLAIN_TEXT);

    return returnJSON({ status: "success", message: "Context Updated", url: file.getUrl() });
}

// ==========================================
//  WEBHOOK & GITHUB V-CRAWLER
// ==========================================

function syncVersionsFromGitHub() {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Modules");
    const data = sheet.getDataRange().getValues();

    const repoOwner = "SignStoreERP";
    const devRepo = "signos-app";
    const liveRepo = "signos-live";

    for (let i = 1; i < data.length; i++) {
        const fileName = data[i][6]; // FIX: Changed from 12 to 2 (File Link is Col C)

        if (fileName && fileName.toString().endsWith(".html")) {
            try {
                const devUrl = `https://raw.githubusercontent.com/${repoOwner}/${devRepo}/main/${fileName}`;
                const devHtml = UrlFetchApp.fetch(devUrl).getContentText();
                const devMatch = devHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
                if (devMatch && devMatch[1]) sheet.getRange(i + 1, 6).setValue(devMatch[1]); // Col F
            } catch (e) {}

            try {
                const liveUrl = `https://raw.githubusercontent.com/${repoOwner}/${liveRepo}/main/${fileName}`;
                const liveHtml = UrlFetchApp.fetch(liveUrl).getContentText();
                const liveMatch = liveHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
                if (liveMatch && liveMatch[1]) sheet.getRange(i + 1, 5).setValue(liveMatch[1]); // Col E
            } catch (e) {}
        }
    }
    return returnJSON({ status: "success" });
}

function doPost(e) {
    try {
        const payload = JSON.parse(e.postData.contents);
        if (!payload.commits) return returnJSON({status: "ignored"});

        const ss = SpreadsheetApp.openById(DATA_SS_ID);
        const logSheet = ss.getSheetByName("SYS_Changelog");

        payload.commits.forEach(c => {
            logSheet.appendRow([new Date(c.timestamp), c.author.name, c.id.substring(0, 7), c.message, c.added.length+c.modified.length, c.url, "LIVE"]);
        });

        syncVersionsFromGitHub();
        return returnJSON({ status: "success" });
    } catch(e) { return returnJSON({ status: "error" }); }
}

// ==========================================
//  UTILITIES & AUTOMATION
// ==========================================

function returnJSON(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function logActivity(p) {
    try {
        const ss = SpreadsheetApp.openById(LOG_SS_ID);
        const sheet = ss.getSheetByName("SYS_Access_Logs");
        sheet.appendRow([new Date(), p.ip || "Unknown", p.user || "GUEST", p.role || "N/A", p.req, p.tab || "N/A", JSON.stringify(p)]);
    } catch (e) {}
}

function archiveDailyLogs() {
    try { processArchive(true); } catch(e) { console.error("Auto Archive Failed", e); }
}

function fetchProductBundle(p) {
  try {
    const payload = {};
    
    // 1. Get Base Config (Uses your new Override logic automatically)
    const configRes = fetchProductWithMatrix(p.tab);
    payload.config = JSON.parse(configRes.getContent());
    
    // 2. Fetch Additional Reference Tables if requested
    if (p.refs) {
      payload.tables = {};
      const refList = p.refs.split(',');
      refList.forEach(ref => {
        const tableRes = fetchTable(ref);
        payload.tables[ref] = JSON.parse(tableRes.getContent());
      });
    }
    
    return returnJSON(payload);
  } catch(e) { 
    return returnJSON({ error: e.toString() }); 
  }
}
