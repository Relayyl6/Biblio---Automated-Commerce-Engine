import asyncio
import edge_tts

async def generate():
    text = "Bro, how you dey? I want two bundles of the 30 inches bone straight hair. Make you pack am sharp sharp, need am for Ikeja GRA today."
    # Use authentic Nigerian male voice
    communicate = edge_tts.Communicate(text, "en-NG-AbeoNeural")
    await communicate.save("landing-page/public/voice-note-demo.mp3")
    print("Voice note generated successfully!")

if __name__ == "__main__":
    asyncio.run(generate())
