"""
Video processing utilities using FFmpeg
"""
import ffmpeg
import os
import tempfile
import subprocess
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
