import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    
    // Choose the vision model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Define the prompt
    const prompt = `
      You are an IT asset management assistant. Your job is to extract structured information from this image.
      The image may be a computer screen showing "ipconfig /all", an asset sticker, or a laptop label.
      
      Extract the following fields and return ONLY a valid JSON object. Do not wrap it in markdown code blocks (\`\`\`json ... \`\`\`). Just return the raw JSON string. If a field is not found, use an empty string.
      
      Fields to extract:
      {
        "macAddressLan": "String - the Physical Address associated with Ethernet / LAN. Example format: A1:B2:C3:D4:E5:F6",
        "macAddressWifi": "String - the Physical Address associated with Wireless / Wi-Fi.",
        "ipAddress": "String - the IPv4 Address",
        "hostName": "String - the Host Name of the computer",
        "assetNumber": "String - Asset or Inventory Number (รหัสครุภัณฑ์), usually printed on a sticker",
        "serialNumber": "String - Serial Number, S/N, or Service Tag",
        "brandModel": "String - Brand and Model of the device if visible"
      }
      
      Note: For MAC addresses, format them with colons (:) between every two characters.
    `;

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: file.type,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    // Parse the JSON (handle potential markdown code blocks)
    let jsonString = responseText.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsedData = JSON.parse(jsonString);

    return NextResponse.json(parsedData);
    
  } catch (error: any) {
    console.error('Error in analyze-image:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze image' }, { status: 500 });
  }
}
