# Gemini Prompt Runner Extension

A powerful Chrome extension that automates sending multiple prompts sequentially to Google Gemini, capturing the AI's responses, and saving them either locally or directly into a Google Spreadsheet.

## Three Modes: Lite, Pro & Extra

### 1. Lite Mode
The standard runner. It sequentially executes a list of custom prompts inside Google Gemini.
- **System Prompt:** Prepend instructions to every prompt.
- **Data Export:** Download responses as a `.txt` file or append them to a Google Sheet row-by-row.

### 2. Pro Mode (Story-to-Script Pipeline)
A highly specialized, multi-step pipeline that builds a script from a single Story Idea. It saves data dynamically to specific columns in your Google Sheet (A, B, C, D).

**The Pipeline Flow:**
1. **Script Outliner:** Combines your Outliner prompt + Story Idea. Saves to `A1`.
2. **Story Architect:** Uses Architect prompt + data from `A1`. The AI outputs a block of episodes, which the extension splits and saves into `B1`, `B2`, etc.
3. **Script Writer:** Loops through all episodes in Column B. Saves the scripts sequentially to `C1`, `C2`, etc.
4. **Scene Details:** Loops through all scripts in Column C. Saves the scene details sequentially to `D1`, `D2`, etc.

*Tip: Ensure your prompts instruct the AI to use numbered headings (e.g., "Episode 1:", "Scene 1:") so the extension can accurately identify and split the blocks.*

**Pro Execution Modes:**
- **Automatic:** Runs the entire 4-step pipeline from start to finish seamlessly.
- **Manual:** Lets you execute individual steps. The extension will read the needed precursor data directly from your Google Sheet and run only that step!

### 3. Extra Mode (Character & Location Details)
An extension of the Pro Pipeline that generates character and location details based on your scene outputs.
- **Character Details Gen:** Reads all scene details from Column D, merges them into a single prompt, and generates a list of characters. The extension then splits the response and saves each character into its own row in **Column E**.
- **Location Details Gen:** Reads all scene details from Column D, merges them into a single prompt, and generates a list of locations. The extension then splits the response and saves each location into its own row in **Column F**.

## Installation

1. Open Google Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** using the toggle in the top right corner.
3. Click the **Load unpacked** button and select the folder containing this extension's files.
4. The extension icon will now appear in your browser toolbar!

---

## 📊 Google Sheets Integration (Webhook Setup)

To use the Pro Pipeline and save responses automatically, you must connect the extension to a Google Sheet Webhook. 

### 1. Prepare your Spreadsheet
1. Open a new or existing [Google Sheet](https://sheets.new/).
2. From the top menu, click **Extensions > Apps Script**.

### 2. Add the Code
1. Delete any existing code in the editor and paste the following script:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  if (data.mode === "pro") {
    // Pro mode: Paste exactly into specific cell
    var cell = data.column + data.row;
    sheet.getRange(cell).setValue(data.response);
  } else {
    // Lite mode: Append new row
    sheet.appendRow([new Date(), data.prompt, data.response]);
  }
  
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var action = e.parameter.action;
  
  if (action === "get") {
    var column = e.parameter.column;
    var lastRow = sheet.getLastRow();
    
    if (lastRow < 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getRange(column + "1:" + column + lastRow).getValues();
    var flatData = data.map(function(row) { return row[0]; });
    
    return ContentService.createTextOutput(JSON.stringify(flatData))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput("Invalid Action");
}
```

### 3. Deploy the Webhook
1. Click the **Save** icon (floppy disk) at the top of the editor.
2. Click the blue **Deploy** button at the top right and select **New deployment**.
3. Click the gear icon `⚙️` next to "Select type" and choose **Web app**.
4. Configure the deployment exactly as follows:
   * **Description:** Gemini Responses
   * **Execute as:** Me
   * **Who has access:** **Anyone** *(This is mandatory so the extension can send/read data).*
5. Click **Deploy**. 
   * *Note: Google will ask you to authorize access. Click through the warnings ("Advanced" -> "Go to script") since it is your own script.*

### 4. Connect to the Extension
1. Copy the **Web app URL** provided in the final step. It will start with `https://script.google.com/macros/s/.../exec`.
2. Open the Gemini Prompt Runner extension.
3. Click the **Settings Gear** icon in the top right.
4. Paste the URL into the **Google Sheets Webhook URL** field.

You're done! The extension will now flawlessly push and pull data from your Google Sheet.
