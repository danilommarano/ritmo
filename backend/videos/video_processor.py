"""
Video processing utilities using FFmpeg
"""
import ffmpeg
import os
import tempfile
import subprocess
import json
from pathlib import Path


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


def export_video_with_elements(video_path, elements, start_time=0, end_time=None, video_metadata=None, bpm_config=None, video_segments=None):
    """
    Export video with visual elements rendered exactly as they appear in the frontend.
    Uses subprocess to run FFmpeg directly for better control over filter syntax.
    Supports video segments for cutting and duplicating portions of the video.
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
        
        # Build filter chain as a list of filter strings
        filters = []
        
        for element in elements:
            el_type = element.get('type')
            x_percent = element.get('x', 50)
            y_percent = element.get('y', 50)
            start_el = element.get('startTime', 0)
            end_el = element.get('endTime', end_time)
            
            print(f"Processing {el_type} element at ({x_percent}%, {y_percent}%)")
            
            if el_type == 'text':
                text = element.get('content', 'Text')
                fontsize = element.get('fontSize', 32)
                font_color, _ = parse_color(element.get('fontColor', '#FFFFFF'))
                has_bg = element.get('hasBackground', False)
                
                # Escape special characters for FFmpeg
                text = text.replace("'", "'\\''").replace(":", "\\:")
                
                # Position centered
                x_expr = f"(w*{x_percent}/100)-(text_w/2)"
                y_expr = f"(h*{y_percent}/100)-(text_h/2)"
                
                filter_str = f"drawtext=text='{text}':fontsize={fontsize}:fontcolor={font_color}"
                filter_str += f":fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
                filter_str += f":x={x_expr}:y={y_expr}"
                filter_str += f":enable='between(t,{start_el},{end_el})'"
                
                if has_bg:
                    bg_color, bg_alpha = parse_color(element.get('backgroundColor', 'rgba(0,0,0,0.5)'))
                    filter_str += f":box=1:boxcolor={bg_color}@{bg_alpha}:boxborderw=8"
                
                filters.append(filter_str)
            
            elif el_type == 'counter' or el_type == 'metronome':
                fontsize = element.get('fontSize', 36)
                font_color, _ = parse_color(element.get('fontColor', '#FFFFFF'))
                has_bg = element.get('hasBackground', True)
                # Support both old 'counterType' and new 'metronomeType' field names
                counter_type = element.get('metronomeType') or element.get('counterType', 'bar-beat')
                
                # Position centered
                x_expr = f"(w*{x_percent}/100)-(text_w/2)"
                y_expr = f"(h*{y_percent}/100)-(text_h/2)"
                
                # BPM calculations
                bpm = bpm_config.get('bpm', 120)
                time_sig = bpm_config.get('timeSignatureNum', 4)
                offset = bpm_config.get('offsetStart', 0)
                beat_duration = 60.0 / bpm
                bar_duration = beat_duration * time_sig
                
                # Use FFmpeg's text expansion with trunc() instead of floor()
                # bar = trunc((t - offset) / bar_duration) + 1
                # beat = mod(trunc((t - offset) / beat_duration), time_sig) + 1
                # Note: Use single backslash for escaping colon in subprocess
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
                    filter_str += f":box=1:boxcolor={bg_color}@{bg_alpha}:boxborderw=12"
                
                filters.append(filter_str)
            
            elif el_type == 'alert':
                alert_type = element.get('alertType', 'flash')
                color_str = element.get('color', 'rgba(255,255,255,0.3)')
                alert_color, alert_alpha = parse_color(color_str)
                
                if alert_type == 'flash':
                    filter_str = f"drawbox=x=0:y=0:w=iw:h=ih:color={alert_color}@{alert_alpha}:t=fill"
                    filter_str += f":enable='between(t,{start_el},{end_el})'"
                    filters.append(filter_str)
        
        # Build FFmpeg command
        filter_complex = ",".join(filters) if filters else None
        
        cmd = [
            'ffmpeg', '-y',
            '-ss', str(start_time),
            '-t', str(end_time - start_time),
            '-i', video_path,
        ]
        
        if filter_complex:
            cmd.extend(['-vf', filter_complex])
        
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
