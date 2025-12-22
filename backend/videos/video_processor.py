"""
Video processing utilities using FFmpeg
"""
import ffmpeg
import os
import tempfile
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
            
            # Create drawtext filter for counter
            # This will show: Bar number | Beat number
            # Formula: bar = floor((t - offset) / bar_duration)
            #          beat = floor(((t - offset) % bar_duration) / beat_duration) + 1
            
            bar_duration = beat_duration * beats_per_bar
            
            # Build the text expression
            # Show "Bar X | Beat Y" or "-- | --" if before offset
            text_expr = (
                f"'Bar: ' + "
                f"(if(gte(t,{offset}), "
                f"floor((t-{offset})/{bar_duration})+1, "
                f"'--')) + "
                f"' | Beat: ' + "
                f"(if(gte(t,{offset}), "
                f"floor(mod(t-{offset},{bar_duration})/{beat_duration})+1, "
                f"'--'))"
            )
            
            # Add text overlay with counter
            video = input_video.video.drawtext(
                text=text_expr,
                fontsize=48,
                fontcolor='white',
                box=1,
                boxcolor='black@0.5',
                boxborderw=10,
                x='(w-text_w)/2',  # Center horizontally
                y='h-th-50'  # 50px from bottom
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
        
        # Run ffmpeg
        ffmpeg.run(output, overwrite_output=True, quiet=True)
        
        return output_path
        
    except Exception as e:
        raise Exception(f'Failed to export video: {str(e)}')


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
