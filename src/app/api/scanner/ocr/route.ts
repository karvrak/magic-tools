import { NextRequest, NextResponse } from 'next/server'

const XAI_API_KEY = process.env.XAI_API_KEY

/**
 * POST /api/scanner/ocr
 * Use Grok Vision API to extract card name from image
 */
export async function POST(request: NextRequest) {
  if (!XAI_API_KEY) {
    return NextResponse.json(
      { error: 'XAI API key not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { image } = body

    if (!image) {
      return NextResponse.json(
        { error: 'image is required (base64 data URL)' },
        { status: 400 }
      )
    }

    // Extract base64 data from data URL
    const base64Match = image.match(/^data:image\/\w+;base64,(.+)$/)
    if (!base64Match) {
      return NextResponse.json(
        { error: 'Invalid image format. Expected base64 data URL.' },
        { status: 400 }
      )
    }

    const base64Data = base64Match[1]
    const mediaType = image.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg'

    // Call Grok Vision API
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-2-vision-latest',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${base64Data}`,
                },
              },
              {
                type: 'text',
                text: `This is a Magic: The Gathering card. Extract ONLY the card name from the top of the card.

Rules:
- Return ONLY the card name, nothing else
- The name is at the top of the card, usually in a banner
- For French cards, return the French name
- For English cards, return the English name
- If you cannot read the name clearly, return "UNKNOWN"
- Do not include mana cost, set symbol, or any other text
- Just the card name, one line, no punctuation at the end

Example responses:
- Llanowar Elves
- Chevalier de la fournaise
- Lightning Bolt
- Ange de Serra`,
              },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Grok API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to analyze image' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const cardName = data.choices?.[0]?.message?.content?.trim()

    if (!cardName || cardName === 'UNKNOWN') {
      return NextResponse.json({
        success: false,
        cardName: null,
        message: 'Could not read card name',
      })
    }

    return NextResponse.json({
      success: true,
      cardName: cardName,
    })
  } catch (error) {
    console.error('OCR API error:', error)
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    )
  }
}
