
from PIL import Image
import os

# Configuration
SOURCE_IMAGE = r"c:\Users\Ro\Google Drive\Kabbalah\apps\Ashera\android\app\src\main\res\drawable\ashera_logo_full.png"
RES_DIR = r"c:\Users\Ro\Google Drive\Kabbalah\apps\Ashera\android\app\src\main\res"

# Standard Android Icon Sizes (Launcher)
# mipmap-mdpi: 48x48
# mipmap-hdpi: 72x72
# mipmap-xhdpi: 96x96
# mipmap-xxhdpi: 144x144
# mipmap-xxxhdpi: 192x192

ICON_SIZES = {
    "mipmap-mdpi": (48, 48),
    "mipmap-hdpi": (72, 72),
    "mipmap-xhdpi": (96, 96),
    "mipmap-xxhdpi": (144, 144),
    "mipmap-xxxhdpi": (192, 192)
}

# Adaptive Icon Foregrounds (108dp) - Logo should be within 66dp safe zone (approx 61% of size)
# 108dp in pixels:
# mdpi (1x): 108px
# hdpi (1.5x): 162px
# xhdpi (2x): 216px
# xxhdpi (3x): 324px
# xxxhdpi (4x): 432px

ADAPTIVE_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432
}

def generate_icons():
    if not os.path.exists(SOURCE_IMAGE):
        print(f"Error: Source image not found at {SOURCE_IMAGE}")
        return

    img = Image.open(SOURCE_IMAGE).convert("RGBA")
    
    # 1. Generate Standard Legacy Icons (ic_launcher.png)
    for folder, size in ICON_SIZES.items():
        target_dir = os.path.join(RES_DIR, folder)
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
        
        # Resize logic: Fit entire logo into square (FORCE RESIZE)
        resized = img.resize(size, Image.Resampling.LANCZOS)
        
        # Center in square if aspect ratio differs (optional, assuming square logo)
        final_img = Image.new("RGBA", size, (0,0,0,0))
        pos = ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2)
        final_img.paste(resized, pos)
        
        # Save Standard Android Name
        final_img.save(os.path.join(target_dir, "ic_launcher.png"))
        
        # Save Manifest-Referenced Names
        final_img.save(os.path.join(target_dir, "ashera_ic_launcher.png"))
        final_img.save(os.path.join(target_dir, "ashera_ic_launcher_round.png"))
        
        print(f"Generated {size} -> ic_launcher, ashera_ic_launcher, round")

        # 2. Generate Adaptive Foregrounds
    
    for folder, canvas_dim in ADAPTIVE_SIZES.items():
        target_dir = os.path.join(RES_DIR, folder)
        
        # Cleanup
        for junk in ["ic_launcher_foreground.png", "ic_launcher_background.png"]:
            junk_path = os.path.join(target_dir, junk)
            if os.path.exists(junk_path):
                try:
                    os.remove(junk_path)
                except:
                    pass

        # Canvas Size
        canvas_size = (canvas_dim, canvas_dim)
        
        # Scale: 75% (0.75)
        # 100% (1.0) caused cropping ("cut off at sides").
        # 61% (0.61) was "too small".
        # 75% is the geometric "Goldilocks" zone for a square in a circle.
        safe_zone_dim = int(canvas_dim * 0.75)
        safe_zone_size = (safe_zone_dim, safe_zone_dim)
        
        # Resize logo to fit Scale (FORCE RESIZE to upscale)
        resized = img.resize(safe_zone_size, Image.Resampling.LANCZOS)
        
        # Place in center of full canvas (Transparent Background)
        final_adaptive = Image.new("RGBA", canvas_size, (0,0,0,0))
        pos = ((canvas_dim - resized.width) // 2, (canvas_dim - resized.height) // 2)
        final_adaptive.paste(resized, pos)
        
        save_path_adaptive = os.path.join(target_dir, "ashera_adaptive_foreground.png")
        final_adaptive.save(save_path_adaptive)
        print(f"Generated Adaptive {canvas_size} (Scale 75%) -> {save_path_adaptive}")

if __name__ == "__main__":
    try:
        generate_icons()
        print("Icon generation complete.")
    except Exception as e:
        print(f"Failed: {e}")
