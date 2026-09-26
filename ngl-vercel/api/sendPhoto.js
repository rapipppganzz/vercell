import fetch from "node-fetch";
import FormData from "form-data";
import BUSBOY from "busboy";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const botToken = "8462682909:AAF9JFROvrPsuYuNpnHOaX_DvYHI3h1DDYU";
  const chatId = "7206573112";

  try {
    const bb = BUSBOY({ headers: req.headers });
    let textMsg = "";
    let photoBuffer = null;
    let fileName = "file.jpg";

    bb.on("field", (name, val) => {
      console.log(`Field received: ${name} = ${val}`);
      if (name === "text") {
        textMsg = val;
      }
    });

    bb.on("file", (fieldname, file, filename, encoding, mimetype) => {
      console.log(`File received: ${fieldname}, filename: ${filename}, mimetype: ${mimetype}`);
      
      const chunks = [];
      file.on("data", (data) => {
        chunks.push(data);
      });
      
      file.on("end", () => {
        photoBuffer = Buffer.concat(chunks);
        fileName = filename || "photo.jpg";
        console.log(`File processed: ${photoBuffer.length} bytes`);
      });
    });

    bb.on("finish", async () => {
      console.log("Form processing finished");
      console.log("Text message:", textMsg);
      console.log("Photo buffer size:", photoBuffer ? photoBuffer.length : 0);

      try {
        let resp;
        let result;

        if (photoBuffer && photoBuffer.length > 0) {
          // Send photo with caption
          console.log("Sending photo...");
          const form = new FormData();
          form.append("chat_id", chatId);
          form.append("caption", textMsg || "📸 Photo");
          form.append("photo", photoBuffer, { 
            filename: fileName,
            contentType: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg'
          });

          resp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            body: form,
          });
        } else if (textMsg && textMsg.trim()) {
          // Send text only
          console.log("Sending text message...");
          resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              chat_id: chatId, 
              text: textMsg.trim(),
              parse_mode: "HTML" // Support HTML formatting
            }),
          });
        } else {
          // No content to send
          return res.status(400).json({ 
            success: false, 
            error: "No text or photo provided" 
          });
        }

        result = await resp.json();
        console.log("Telegram API Response:", result);

        if (result.ok) {
          res.status(200).json({ 
            success: true, 
            result,
            message: photoBuffer ? "Photo sent successfully" : "Message sent successfully"
          });
        } else {
          console.error("Telegram API Error:", result);
          res.status(400).json({ 
            success: false, 
            error: result.description || "Telegram API error",
            telegram_response: result
          });
        }

      } catch (err) {
        console.error("Error in sendPhoto API:", err);
        res.status(500).json({ 
          success: false, 
          error: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    });

    bb.on("error", (err) => {
      console.error("Busboy error:", err);
      res.status(500).json({ 
        success: false, 
        error: "Form parsing error: " + err.message 
      });
    });

    // Timeout handling
    const timeout = setTimeout(() => {
      console.error("Request timeout");
      if (!res.headersSent) {
        res.status(408).json({ 
          success: false, 
          error: "Request timeout" 
        });
      }
    }, 30000); // 30 seconds

    bb.on("finish", () => {
      clearTimeout(timeout);
    });

    req.pipe(bb);

  } catch (err) {
    console.error("Outer error in sendPhoto:", err);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: "Internal server error: " + err.message 
      });
    }
  }
}
