# Gemini Prompt Runner Extension

A powerful Chrome extension that automates sending multiple prompts sequentially to Google Gemini, capturing the AI's responses, and saving them either locally or directly into a Google Spreadsheet.

## How It Works

1. **Automation:** The extension runs a list of predefined prompts one by one inside the Google Gemini web interface (`gemini.google.com/app`).
2. **Context Customization:** You can define a "System Prompt" that gets automatically prepended to every prompt you run. 
3. **Response Capture:** After Gemini finishes generating a response for a prompt, the extension captures the exact text.
4. **Data Export:** Once the prompts are done, you have two ways to save the responses:
   - **Download:** Click the "Download Responses" button in the extension popup to get a `.txt` file with all your prompts and their respective responses.
   - **Google Sheets Sync:** Provide a Google Apps Script Webhook URL to have the extension automatically send each prompt and response directly into a Google Sheet in real-time.

## Installation

1. Open Google Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** using the toggle in the top right corner.
3. Click the **Load unpacked** button and select the folder containing this extension's files.
4. The extension icon will now appear in your browser toolbar!

## Usage Guide

1. Navigate to [Google Gemini](https://gemini.google.com/app).
2. Click the extension icon to open the prompt runner interface.
3. (Optional) Enter a **System Prompt**.
4. Type or paste your individual prompts and click **Add**.
5. Adjust settings like **New chat per prompt** if you want each prompt to run in an isolated conversation.
6. Click **Start** and watch the extension do the work!

---

## 📊 Google Sheets Integration (Webhook Setup)

You can configure the extension to automatically send Gemini's responses straight into a Google Sheet. Follow these exact steps to create your Webhook URL:

### 1. Prepare your Spreadsheet
1. Open a new or existing [Google Sheet](https://sheets.new/).
2. From the top menu, click **Extensions > Apps Script**.

### 2. Add the Code
1. Delete any existing code in the editor and paste the following script exactly as is:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Parse the data sent from the extension
  var data = JSON.parse(e.postData.contents);
  var prompt = data.prompt;
  var response = data.response;
  
  // Add a new row: [Timestamp, Prompt, Response]
  sheet.appendRow([new Date(), prompt, response]);
  
  // Return success response to the extension
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}
```

### 3. Deploy the Webhook
1. Click the **Save** icon (floppy disk) at the top of the editor.
2. Click the blue **Deploy** button at the top right and select **New deployment**.
3. Click the gear icon `⚙️` next to "Select type" and choose **Web app**.
4. Configure the deployment exactly as follows:
   * **Description:** Gemini Responses (or whatever you prefer)
   * **Execute as:** Me
   * **Who has access:** **Anyone** *(This is mandatory so the extension can send data to it).*
5. Click **Deploy**. 
   * *Note: Google will likely ask you to authorize access. Click through the warnings ("Advanced" -> "Go to script") since it is your own script.*

### 4. Connect to the Extension
1. Once deployed, copy the **Web app URL** provided in the final step. It will start with `https://script.google.com/macros/s/.../exec`.
2. Open the Gemini Prompt Runner extension.
3. Paste that URL into the **Google Sheets Webhook URL** field.

You're done! The next time you run your prompts, the responses will appear in your Google Sheet in real-time.
