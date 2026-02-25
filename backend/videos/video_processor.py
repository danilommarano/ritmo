"""
Video processing utilities using FFmpeg
"""
import ffmpeg
import os
import tempfile
import subprocess
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def extract_video_metadata(video_path):
    """
    Extract metadata from video file using ffmpeg.
    
    Args:
        video_path: Path to the video file
        
    Returns:
        dict with duration, fps, width, height
    """
    try:
        probe = ffmpeg.probe(video_path)
        video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
        
        if not video_stream:
            raise ValueError('No video stream found')
        
        # Get duration
        duration = float(probe['format']['duration'])
        
        # Get FPS
        fps_str = video_stream['r_frame_rate']
        num, den = map(int, fps_str.split('/'))
        fps = num / den if den != 0 else 30.0
        
        # Get dimensions
        width = int(video_stream['width'])
        height = int(video_stream['height'])
        
        return {
            'duration': duration,
            'fps': fps,
            'width': width,
            'height': height
        }
    except Exception as e:
        raise Exception(f'Failed to extract metadata: {str(e)}')


def export_video_with_counter(video_path, start_time, end_time, rhythm_grid=None):
    """
    Export video segment with rhythm counter overlay.
    
    Args:
        video_path: Path to the input video
        start_time: Start time in seconds
        end_time: End time in seconds
        rhythm_grid: RhythmGrid model instance (optional)
        
    Returns:
        Path to the exported video file
    """
    try:
        # Create temporary output file
        output_dir = tempfile.gettempdir()
        output_filename = f'video_with_counter_{os.getpid()}.mp4'
        output_path = os.path.join(output_dir, output_filename)
        
        # Input video
        input_video = ffmpeg.input(video_path, ss=start_time, t=(end_time - start_time))
        
        if rhythm_grid:
            # Calculate rhythm parameters
            bpm = rhythm_grid.bpm
            beat_duration = 60.0 / bpm
            beats_per_bar = rhythm_grid.beats_per_bar
            offset = rhythm_grid.offset_start
            bar_duration = beat_duration * beats_per_bar
            
            # Build the drawtext filter string manually for proper escaping
            # The text expression needs to calculate bar and beat numbers dynamically
            bar_calc = f"floor((t-{offset})/{bar_duration})+1"
            beat_calc = f"floor(mod(t-{offset},{bar_duration})/{beat_duration})+1"
            
            # Use FFmpeg's text expansion with proper escaping
            # %{eif:expr:d} evaluates expression and formats as decimal
            text_string = f"Compasso: %{{eif:{bar_calc}:d}} | Batida: %{{eif:{beat_calc}:d}}"
            
            # Apply drawtext filter using filter method for better control
            video = input_video.video.filter(
                'drawtext',
                text=text_string,
                fontsize=48,
                fontcolor='white',
                box=1,
                boxcolor='black@0.5',
                boxborderw=10,
                x='(w-text_w)/2',
                y='h-th-50',
                enable=f'gte(t,{offset})'
            )
            
            audio = input_video.audio
            
        else:
            # No rhythm grid, just show elapsed time
            video = input_video.video.drawtext(
                text='%{pts\\:hms}',
                fontsize=48,
                fontcolor='white',
                box=1,
                boxcolor='black@0.5',
                boxborderw=10,
                x='(w-text_w)/2',
                y='h-th-50'
            )
            
            audio = input_video.audio
        
        # Output with video and audio
        output = ffmpeg.output(
            video,
            audio,
            output_path,
            vcodec='libx264',
            acodec='aac',
            **{'b:v': '2M', 'b:a': '192k'}
        )
        
        # Log the command for debugging
        cmd = ffmpeg.compile(output, overwrite_output=True)
        print(f"FFmpeg command: {' '.join(cmd)}")
        
        # Run ffmpeg
        ffmpeg.run(output, overwrite_output=True, quiet=False)
        
        return output_path
        
    except Exception as e:
        raise Exception(f'Failed to export video: {str(e)}')


def calculate_bar_beat(time_seconds, bpm, time_signature_num, offset_start):
    """
    Calculate bar and beat from time, matching frontend logic exactly.
    """
    if time_seconds < offset_start:
        return (0, 0)
    
    beat_duration = 60.0 / bpm
    bar_duration = beat_duration * time_signature_num
    elapsed = time_seconds - offset_start
    
    bar = int(elapsed / bar_duration) + 1
    beat = int((elapsed % bar_duration) / beat_duration) + 1
    
    return (bar, beat)


def parse_color(color_str):
    """
    Parse color string to FFmpeg format.
    Handles: #FFFFFF, rgba(0,0,0,0.7), white, etc.
    Returns: (color_hex, alpha)
    """
    if not color_str:
        return ('FFFFFF', 1.0)
    
    color_str = color_str.strip()
    
    # Handle rgba format: rgba(0, 0, 0, 0.7)
    if color_str.startswith('rgba('):
        try:
            inner = color_str[5:-1]  # Remove 'rgba(' and ')'
            parts = [p.strip() for p in inner.split(',')]
            r, g, b = int(parts[0]), int(parts[1]), int(parts[2])
            a = float(parts[3])
            hex_color = f'{r:02x}{g:02x}{b:02x}'
            return (hex_color, a)
        except:
            return ('000000', 0.7)
    
    # Handle hex format: #FFFFFF
    if color_str.startswith('#'):
        return (color_str[1:], 1.0)
    
    # Handle named colors
    named_colors = {
        'white': 'FFFFFF',
        'black': '000000',
        'red': 'FF0000',
        'green': '00FF00',
        'blue': '0000FF',
        'yellow': 'FFFF00',
    }
    return (named_colors.get(color_str.lower(), 'FFFFFF'), 1.0)


def parse_color_rgba(color_str):
    """Parse color string to RGBA tuple (0-255 for RGB, 0-255 for A)"""
    if not color_str:
        return (255, 255, 255, 255)
    
    if color_str.startswith('rgba('):
        try:
            inner = color_str[5:-1]
            parts = [p.strip() for p in inner.split(',')]
            r, g, b = int(parts[0]), int(parts[1]), int(parts[2])
            a = int(float(parts[3]) * 255)
            return (r, g, b, a)
        except:
            return (0, 0, 0, 178)
    
    if color_str.startswith('rgb('):
        try:
            inner = color_str[4:-1]
            parts = [p.strip() for p in inner.split(',')]
            r, g, b = int(parts[0]), int(parts[1]), int(parts[2])
            return (r, g, b, 255)
        except:
            return (255, 255, 255, 255)
    
    if color_str.startswith('#'):
        hex_color = color_str[1:]
        if len(hex_color) == 6:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            return (r, g, b, 255)
        elif len(hex_color) == 8:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            a = int(hex_color[6:8], 16)
            return (r, g, b, a)
    
    named_colors = {
        'white': (255, 255, 255, 255),
        'black': (0, 0, 0, 255),
        'red': (255, 0, 0, 255),
        'green': (0, 255, 0, 255),
        'blue': (0, 0, 255, 255),
        'yellow': (255, 255, 0, 255),
    }
    return named_colors.get(color_str.lower(), (255, 255, 255, 255))


def draw_rounded_rectangle(draw, xy, radius, fill):
    """Draw a rounded rectangle on a PIL ImageDraw object"""
    x1, y1, x2, y2 = xy
    
    # Ensure radius doesn't exceed half the smallest dimension
    max_radius = min((x2 - x1) // 2, (y2 - y1) // 2)
    radius = min(radius, max_radius)
    
    if radius <= 0:
        draw.rectangle(xy, fill=fill)
        return
    
    # Draw the main rectangle body
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    
    # Draw the four corners
    draw.pieslice([x1, y1, x1 + 2*radius, y1 + 2*radius], 180, 270, fill=fill)
    draw.pieslice([x2 - 2*radius, y1, x2, y1 + 2*radius], 270, 360, fill=fill)
    draw.pieslice([x1, y2 - 2*radius, x1 + 2*radius, y2], 90, 180, fill=fill)
    draw.pieslice([x2 - 2*radius, y2 - 2*radius, x2, y2], 0, 90, fill=fill)


def get_emoji_font(size):
    """Try to get a font that supports color emojis"""
    emoji_font_paths = [
        '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
        '/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf',
        '/usr/share/fonts/google-noto-emoji/NotoColorEmoji.ttf',
        '/System/Library/Fonts/Apple Color Emoji.ttc',
        '/usr/share/fonts/truetype/twitter-color-emoji/TwitterColorEmoji-SVGinOT.ttf',
    ]
    
    for path in emoji_font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    return None


def get_text_font(size, bold=False, monospace=False):
    """Get a text font with fallback options"""
    if monospace:
        font_paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
        ]
    else:
        font_paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        ]
    
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    
    return ImageFont.load_default()


def has_emoji(text):
    """Check if text contains emoji characters"""
    import re
    # Emoji regex pattern
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U00002702-\U000027B0"  # dingbats
        "\U000024C2-\U0001F251"  # enclosed characters
        "\U0001F900-\U0001F9FF"  # supplemental symbols
        "\U0001FA00-\U0001FA6F"  # chess symbols
        "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-A
        "\U00002600-\U000026FF"  # misc symbols
        "]+", 
        flags=re.UNICODE
    )
    return bool(emoji_pattern.search(text))


def render_text_element_image(element, video_width, video_height, scale_factor=1.0):
    """
    Render a text element as a PNG image with proper styling.
    Returns the image and its position (x, y) in pixels.
    Supports emojis when Noto Color Emoji font is available.
    """
    text = element.get('content', 'Text')
    font_size = int(element.get('fontSize', 32) * scale_factor)
    font_color = parse_color_rgba(element.get('fontColor', '#FFFFFF'))
    has_bg = element.get('hasBackground', False)
    bg_color = parse_color_rgba(element.get('backgroundColor', 'rgba(0,0,0,0.5)'))
    font_weight = element.get('fontWeight', 'normal')
    
    # Padding and border radius matching frontend
    padding_x = int(16 * scale_factor) if has_bg else 0
    padding_y = int(8 * scale_factor) if has_bg else 0
    border_radius = int(8 * scale_factor) if has_bg else 0
    
    # Get font - try emoji font if text contains emojis
    is_bold = font_weight == 'bold' or font_weight == '700'
    
    # Check if text contains emojis
    text_has_emoji = has_emoji(text)
    
    if text_has_emoji:
        # Try to use Noto Color Emoji or similar
        emoji_font = get_emoji_font(font_size)
        if emoji_font:
            font = emoji_font
            print(f"Using emoji font for text: {text[:20]}...")
        else:
            font = get_text_font(font_size, bold=is_bold)
            print(f"Warning: No emoji font available, emojis may not render correctly")
    else:
        font = get_text_font(font_size, bold=is_bold)
    
    # Calculate text size
    temp_img = Image.new('RGBA', (1, 1))
    temp_draw = ImageDraw.Draw(temp_img)
    bbox = temp_draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Ensure minimum dimensions
    text_width = max(text_width, 10)
    text_height = max(text_height, font_size)
    
    # Create image with padding
    img_width = text_width + 2 * padding_x
    img_height = text_height + 2 * padding_y
    
    img = Image.new('RGBA', (img_width, img_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw background if enabled
    if has_bg:
        draw_rounded_rectangle(draw, [0, 0, img_width, img_height], border_radius, bg_color)
    
    # Draw text - use embedded_color=True for color emoji support if available
    try:
        draw.text((padding_x - bbox[0], padding_y - bbox[1]), text, font=font, fill=font_color, embedded_color=True)
    except TypeError:
        # Older PIL versions don't support embedded_color
        draw.text((padding_x - bbox[0], padding_y - bbox[1]), text, font=font, fill=font_color)
    
    # Calculate position in video (centered on x%, y%)
    x_percent = element.get('x', 50)
    y_percent = element.get('y', 50)
    pos_x = int((x_percent / 100) * video_width - img_width / 2)
    pos_y = int((y_percent / 100) * video_height - img_height / 2)
    
    return img, pos_x, pos_y


def render_metronome_element_image(element, video_width, video_height, bar, beat, scale_factor=1.0):
    """
    Render a metronome element as a PNG image with proper styling.
    """
    metronome_type = element.get('metronomeType', 'bar-beat')
    font_size = int(element.get('fontSize', 36) * scale_factor)
    font_color = parse_color_rgba(element.get('fontColor', '#FFFFFF'))
    has_bg = element.get('hasBackground', True)
    bg_color = parse_color_rgba(element.get('backgroundColor', 'rgba(0,0,0,0.7)'))
    
    # Generate text based on type
    if metronome_type == 'bar':
        text = str(bar)
    elif metronome_type == 'beat':
        text = str(beat)
    else:  # bar-beat
        text = f"{bar}.{beat}"
    
    if bar <= 0:
        text = "--"
    
    # Padding and border radius matching frontend (larger for metronome)
    padding_x = int(24 * scale_factor) if has_bg else 0
    padding_y = int(12 * scale_factor) if has_bg else 0
    border_radius = int(12 * scale_factor) if has_bg else 0
    
    # Get monospace font
    font = get_text_font(font_size, bold=True, monospace=True)
    
    # Calculate text size
    temp_img = Image.new('RGBA', (1, 1))
    temp_draw = ImageDraw.Draw(temp_img)
    bbox = temp_draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Minimum width for consistency
    min_width = int(80 * scale_factor)
    img_width = max(text_width + 2 * padding_x, min_width)
    img_height = text_height + 2 * padding_y
    
    img = Image.new('RGBA', (img_width, img_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw background
    if has_bg:
        draw_rounded_rectangle(draw, [0, 0, img_width, img_height], border_radius, bg_color)
    
    # Draw text centered
    text_x = (img_width - text_width) // 2 - bbox[0]
    text_y = padding_y - bbox[1]
    draw.text((text_x, text_y), text, font=font, fill=font_color)
    
    # Calculate position
    x_percent = element.get('x', 50)
    y_percent = element.get('y', 50)
    pos_x = int((x_percent / 100) * video_width - img_width / 2)
    pos_y = int((y_percent / 100) * video_height - img_height / 2)
    
    return img, pos_x, pos_y


def render_timer_element_image(element, video_width, video_height, current_time, scale_factor=1.0):
    """
    Render a timer element as a PNG image with proper styling.
    """
    font_size = int(element.get('fontSize', 36) * scale_factor)
    font_color = parse_color_rgba(element.get('fontColor', '#FFFFFF'))
    has_bg = element.get('hasBackground', True)
    bg_color = parse_color_rgba(element.get('backgroundColor', 'rgba(0,0,0,0.7)'))
    
    # Format time as MM:SS.ms
    minutes = int(current_time // 60)
    seconds = int(current_time % 60)
    ms = int((current_time % 1) * 100)
    text = f"{minutes:02d}:{seconds:02d}.{ms:02d}"
    
    # Padding and border radius
    padding_x = int(24 * scale_factor) if has_bg else 0
    padding_y = int(12 * scale_factor) if has_bg else 0
    border_radius = int(12 * scale_factor) if has_bg else 0
    
    # Get monospace font
    font = get_text_font(font_size, bold=True, monospace=True)
    
    # Calculate text size
    temp_img = Image.new('RGBA', (1, 1))
    temp_draw = ImageDraw.Draw(temp_img)
    bbox = temp_draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    min_width = int(100 * scale_factor)
    img_width = max(text_width + 2 * padding_x, min_width)
    img_height = text_height + 2 * padding_y
    
    img = Image.new('RGBA', (img_width, img_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    if has_bg:
        draw_rounded_rectangle(draw, [0, 0, img_width, img_height], border_radius, bg_color)
    
    text_x = (img_width - text_width) // 2 - bbox[0]
    text_y = padding_y - bbox[1]
    draw.text((text_x, text_y), text, font=font, fill=font_color)
    
    x_percent = element.get('x', 50)
    y_percent = element.get('y', 50)
    pos_x = int((x_percent / 100) * video_width - img_width / 2)
    pos_y = int((y_percent / 100) * video_height - img_height / 2)
    
    return img, pos_x, pos_y


def export_video_with_elements(video_path, elements, start_time=0, end_time=None, video_metadata=None, bpm_config=None, video_segments=None, preview_width=None, preview_height=None):
    """
    Export video with visual elements rendered exactly as they appear in the frontend.
    Uses subprocess to run FFmpeg directly for better control over filter syntax.
    Supports video segments for cutting and duplicating portions of the video.
    
    Args:
        preview_width: Width of the video preview in the frontend (for scale calculation)
        preview_height: Height of the video preview in the frontend (for scale calculation)
    """
    try:
        if not video_metadata:
            video_metadata = extract_video_metadata(video_path)
        
        if end_time is None:
            end_time = video_metadata['duration']
        
        video_width = video_metadata.get('width', 1920)
        video_height = video_metadata.get('height', 1080)
        original_duration = video_metadata.get('duration', end_time)
        
        if not bpm_config:
            bpm_config = {
                'bpm': 120,
                'timeSignatureNum': 4,
                'offsetStart': 0
            }
        
        output_dir = tempfile.gettempdir()
        output_filename = f'video_with_elements_{os.getpid()}.mp4'
        output_path = os.path.join(output_dir, output_filename)
        
        print(f"Exporting video with {len(elements)} elements")
        print(f"Video dimensions: {video_width}x{video_height}")
        print(f"BPM config: {bpm_config}")
        print(f"Video segments: {video_segments}")
        
        # If we have video segments, we need to process them first
        # Each segment references a portion of the original video
        if video_segments and len(video_segments) > 1:
            # Create temporary files for each segment
            segment_files = []
            for i, segment in enumerate(video_segments):
                seg_start = segment.get('start_time', 0)
                seg_end = segment.get('end_time', original_duration)
                seg_speed = segment.get('speed', 1.0)
                seg_duration = seg_end - seg_start
                
                segment_output = os.path.join(output_dir, f'segment_{os.getpid()}_{i}.mp4')
                segment_files.append(segment_output)
                
                # Extract this segment from the original video
                seg_cmd = [
                    'ffmpeg', '-y',
                    '-ss', str(seg_start),
                    '-t', str(seg_duration),
                    '-i', video_path,
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-c:a', 'aac',
                    segment_output
                ]
                
                print(f"Creating segment {i}: {seg_start}s - {seg_end}s")
                result = subprocess.run(seg_cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    print(f"Segment extraction failed: {result.stderr}")
                    raise Exception(f"Failed to extract segment {i}")
            
            # Create a concat file
            concat_file = os.path.join(output_dir, f'concat_{os.getpid()}.txt')
            with open(concat_file, 'w') as f:
                for seg_file in segment_files:
                    f.write(f"file '{seg_file}'\n")
            
            # Concatenate all segments into a temporary file
            concat_output = os.path.join(output_dir, f'concat_output_{os.getpid()}.mp4')
            concat_cmd = [
                'ffmpeg', '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', concat_file,
                '-c', 'copy',
                concat_output
            ]
            
            print(f"Concatenating {len(segment_files)} segments")
            result = subprocess.run(concat_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Concat failed: {result.stderr}")
                raise Exception(f"Failed to concatenate segments")
            
            # Use the concatenated video as input for element rendering
            video_path = concat_output
            
            # Clean up segment files (keep concat output for now)
            for seg_file in segment_files:
                try:
                    os.remove(seg_file)
                except:
                    pass
            try:
                os.remove(concat_file)
            except:
                pass
            
            # Update end_time to match the new concatenated duration
            total_duration = sum(
                (seg.get('end_time', original_duration) - seg.get('start_time', 0))
                for seg in video_segments
            )
            end_time = total_duration
            start_time = 0
        
        # Calculate scale factor based on preview vs actual video dimensions
        # The frontend renders elements at the preview size, so we need to scale them
        # proportionally to the actual video resolution for export
        #
        # Example: If preview is 300px wide and video is 1080px wide,
        # a 32px font in preview should become 32 * (1080/300) = 115px in export
        
        if preview_width and preview_width > 0:
            # Use the preview width to calculate scale factor
            scale_factor = video_width / preview_width
        elif preview_height and preview_height > 0:
            # Fallback to height if width not available
            scale_factor = video_height / preview_height
        else:
            # Fallback: assume a typical mobile preview width of 360px
            # This is a reasonable default for vertical phone videos
            default_preview_width = 360
            scale_factor = video_width / default_preview_width
        
        print(f"Scale factor: {scale_factor:.2f} (video: {video_width}x{video_height}px, preview: {preview_width}x{preview_height}px)")
        
        # Separate elements into static (text) and dynamic (metronome, timer)
        static_elements = []
        dynamic_elements = []
        alert_elements = []
        
        for element in elements:
            el_type = element.get('type')
            if el_type == 'text':
                static_elements.append(element)
            elif el_type in ('metronome', 'counter', 'timer'):
                dynamic_elements.append(element)
            elif el_type == 'alert':
                alert_elements.append(element)
        
        # Build filter chain
        filters = []
        overlay_inputs = []
        input_index = 1  # 0 is the video
        
        # Process static text elements - render as PNG overlays
        for i, element in enumerate(static_elements):
            start_el = element.get('startTime', 0)
            end_el = element.get('endTime', end_time)
            
            # Render element as PNG
            img, pos_x, pos_y = render_text_element_image(element, video_width, video_height, scale_factor)
            
            # Save PNG
            png_path = os.path.join(output_dir, f'element_{os.getpid()}_{i}.png')
            img.save(png_path, 'PNG')
            overlay_inputs.append({
                'path': png_path,
                'x': pos_x,
                'y': pos_y,
                'start': start_el,
                'end': end_el
            })
            print(f"Created text overlay: {png_path} at ({pos_x}, {pos_y})")
        
        # Process dynamic elements (metronome, timer) - still use drawtext for dynamic content
        # but with improved styling
        for element in dynamic_elements:
            el_type = element.get('type')
            x_percent = element.get('x', 50)
            y_percent = element.get('y', 50)
            start_el = element.get('startTime', 0)
            end_el = element.get('endTime', end_time)
            
            # Scale font size
            base_fontsize = element.get('fontSize', 36)
            fontsize = int(base_fontsize * scale_factor)
            font_color, _ = parse_color(element.get('fontColor', '#FFFFFF'))
            has_bg = element.get('hasBackground', True)
            
            # Position centered
            x_expr = f"(w*{x_percent}/100)-(text_w/2)"
            y_expr = f"(h*{y_percent}/100)-(text_h/2)"
            
            if el_type in ('metronome', 'counter'):
                counter_type = element.get('metronomeType') or element.get('counterType', 'bar-beat')
                
                # BPM calculations
                bpm = bpm_config.get('bpm', 120)
                time_sig = bpm_config.get('timeSignatureNum', 4)
                offset = bpm_config.get('offsetStart', 0)
                beat_duration = 60.0 / bpm
                bar_duration = beat_duration * time_sig
                
                if counter_type == 'time':
                    text_expr = "%{pts\\:hms}"
                elif counter_type == 'bar':
                    text_expr = f"%{{eif\\:trunc((t-{offset})/{bar_duration})+1\\:d}}"
                elif counter_type == 'beat':
                    text_expr = f"%{{eif\\:mod(trunc((t-{offset})/{beat_duration}),{time_sig})+1\\:d}}"
                else:  # bar-beat
                    text_expr = f"%{{eif\\:trunc((t-{offset})/{bar_duration})+1\\:d}}.%{{eif\\:mod(trunc((t-{offset})/{beat_duration}),{time_sig})+1\\:d}}"
                
                filter_str = f"drawtext=text='{text_expr}':fontsize={fontsize}:fontcolor={font_color}"
                filter_str += f":fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
                filter_str += f":x={x_expr}:y={y_expr}"
                filter_str += f":enable='between(t,{start_el},{end_el})'"
                
                if has_bg:
                    bg_color, bg_alpha = parse_color(element.get('backgroundColor', 'rgba(0,0,0,0.7)'))
                    # Scale padding
                    box_padding = int(12 * scale_factor)
                    filter_str += f":box=1:boxcolor={bg_color}@{bg_alpha}:boxborderw={box_padding}"
                
                filters.append(filter_str)
            
            elif el_type == 'timer':
                # Timer uses pts:hms format
                text_expr = "%{pts\\:hms}"
                
                filter_str = f"drawtext=text='{text_expr}':fontsize={fontsize}:fontcolor={font_color}"
                filter_str += f":fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
                filter_str += f":x={x_expr}:y={y_expr}"
                filter_str += f":enable='between(t,{start_el},{end_el})'"
                
                if has_bg:
                    bg_color, bg_alpha = parse_color(element.get('backgroundColor', 'rgba(0,0,0,0.7)'))
                    box_padding = int(12 * scale_factor)
                    filter_str += f":box=1:boxcolor={bg_color}@{bg_alpha}:boxborderw={box_padding}"
                
                filters.append(filter_str)
        
        # Process alert elements
        for element in alert_elements:
            start_el = element.get('startTime', 0)
            end_el = element.get('endTime', end_time)
            alert_type = element.get('alertType', 'flash')
            color_str = element.get('color', 'rgba(255,255,255,0.3)')
            alert_color, alert_alpha = parse_color(color_str)
            
            if alert_type == 'flash':
                filter_str = f"drawbox=x=0:y=0:w=iw:h=ih:color={alert_color}@{alert_alpha}:t=fill"
                filter_str += f":enable='between(t,{start_el},{end_el})'"
                filters.append(filter_str)
        
        # Build FFmpeg command with overlay inputs
        cmd = [
            'ffmpeg', '-y',
            '-ss', str(start_time),
            '-t', str(end_time - start_time),
            '-i', video_path,
        ]
        
        # Add PNG inputs for overlays
        for overlay in overlay_inputs:
            cmd.extend(['-i', overlay['path']])
        
        # Build filter complex with overlays
        if overlay_inputs or filters:
            filter_parts = []
            
            # Start with video stream
            current_stream = '[0:v]'
            
            # Add drawtext filters first (they work on the video directly)
            if filters:
                drawtext_chain = ",".join(filters)
                filter_parts.append(f"{current_stream}{drawtext_chain}[v_text]")
                current_stream = '[v_text]'
            
            # Add PNG overlays
            for i, overlay in enumerate(overlay_inputs):
                input_idx = i + 1
                next_stream = f'[v_overlay{i}]'
                
                # Overlay with enable for time range
                overlay_filter = f"{current_stream}[{input_idx}:v]overlay=x={overlay['x']}:y={overlay['y']}"
                overlay_filter += f":enable='between(t,{overlay['start']},{overlay['end']})'"
                overlay_filter += next_stream
                
                filter_parts.append(overlay_filter)
                current_stream = next_stream
            
            # Final output mapping
            filter_complex = ";".join(filter_parts)
            
            if filter_parts:
                cmd.extend(['-filter_complex', filter_complex])
                # Map the final video stream (without brackets)
                final_stream = current_stream.strip('[]')
                cmd.extend(['-map', f'[{final_stream}]'])
                cmd.extend(['-map', '0:a?'])
            else:
                cmd.extend(['-vf', ",".join(filters)])
        
        cmd.extend([
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-c:a', 'aac',
            '-b:a', '192k',
            output_path
        ])
        
        print(f"FFmpeg command: {' '.join(cmd)}")
        
        # Run FFmpeg
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Clean up PNG files
        for overlay in overlay_inputs:
            try:
                os.remove(overlay['path'])
            except:
                pass
        
        if result.returncode != 0:
            print(f"FFmpeg stderr: {result.stderr}")
            raise Exception(f"FFmpeg failed: {result.stderr[-500:]}")
        
        return output_path
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise Exception(f'Failed to export video with elements: {str(e)}')


def generate_thumbnail(video_path, time_position=1.0):
    """
    Generate a thumbnail from video at specified time position.
    
    Args:
        video_path: Path to the video file
        time_position: Time position in seconds to capture thumbnail
        
    Returns:
        Path to the generated thumbnail
    """
    try:
        output_dir = tempfile.gettempdir()
        output_filename = f'thumbnail_{os.getpid()}.jpg'
        output_path = os.path.join(output_dir, output_filename)
        
        (
            ffmpeg
            .input(video_path, ss=time_position)
            .filter('scale', 320, -1)
            .output(output_path, vframes=1)
            .overwrite_output()
            .run(quiet=True)
        )
        
        return output_path
        
    except Exception as e:
        raise Exception(f'Failed to generate thumbnail: {str(e)}')
