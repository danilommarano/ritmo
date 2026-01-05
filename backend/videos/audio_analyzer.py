"""
Audio analysis utilities for beat detection and BPM estimation.

This module extracts audio from video files and analyzes it to detect
beats and estimate BPM using librosa.
"""
import os
import tempfile
import subprocess
import numpy as np
import librosa
import librosa.display


def extract_audio_from_video(video_path, output_path=None):
    """
    Extract audio from video file using FFmpeg.
    
    Args:
        video_path: Path to the video file
        output_path: Optional path for output audio file. If None, creates temp file.
        
    Returns:
        Path to the extracted audio file (WAV format)
    """
    if output_path is None:
        # Create temporary file for audio
        fd, output_path = tempfile.mkstemp(suffix='.wav')
        os.close(fd)
    
    try:
        # Extract audio using FFmpeg
        # Convert to mono, 22050 Hz sample rate (standard for librosa)
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-vn',  # No video
            '-acodec', 'pcm_s16le',  # PCM 16-bit
            '-ar', '22050',  # Sample rate
            '-ac', '1',  # Mono
            '-y',  # Overwrite output file
            output_path
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )
        
        return output_path
        
    except subprocess.CalledProcessError as e:
        raise Exception(f'Failed to extract audio: {e.stderr.decode()}')


def detect_beats_and_bpm(audio_path, video_duration=None):
    """
    Detect beats and estimate BPM from audio file.
    
    Uses librosa's beat tracking algorithm which analyzes the onset strength
    envelope to find rhythmic patterns.
    
    Args:
        audio_path: Path to the audio file
        video_duration: Optional video duration to validate beat timestamps
        
    Returns:
        dict with:
            - bpm: Estimated BPM (float)
            - beat_timestamps: List of beat timestamps in seconds (list of floats)
            - confidence: Confidence score of the detection (float, 0-1)
    """
    try:
        # Load audio file
        print(f"Loading audio from {audio_path}...")
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        
        print(f"Audio loaded: duration={len(y)/sr:.2f}s, sample_rate={sr}")
        
        # Detect tempo and beats
        # onset_envelope: measure of note onsets (sudden increases in energy)
        # aggregate: use median for more robust tempo estimation
        print("Detecting tempo and beats...")
        tempo, beat_frames = librosa.beat.beat_track(
            y=y,
            sr=sr,
            units='frames',
            start_bpm=120.0,  # Initial guess
            tightness=100  # How closely to follow the tempo (higher = stricter)
        )
        
        # Convert beat frames to timestamps
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        
        print(f"Detected tempo: {tempo:.2f} BPM")
        print(f"Detected {len(beat_times)} beats")
        
        # Calculate confidence based on beat consistency
        confidence = calculate_beat_confidence(beat_times, tempo)
        
        # Filter beats if video_duration is provided
        if video_duration:
            beat_times = [t for t in beat_times if t <= video_duration]
        
        return {
            'bpm': float(tempo),
            'beat_timestamps': beat_times.tolist(),
            'confidence': confidence,
            'total_beats': len(beat_times)
        }
        
    except Exception as e:
        raise Exception(f'Failed to detect beats: {str(e)}')


def calculate_beat_confidence(beat_times, tempo):
    """
    Calculate confidence score based on beat consistency.
    
    A good beat detection should have relatively consistent intervals
    between beats. This function calculates the coefficient of variation
    (std/mean) of beat intervals and converts it to a confidence score.
    
    Args:
        beat_times: Array of beat timestamps
        tempo: Detected tempo in BPM
        
    Returns:
        Confidence score between 0 and 1
    """
    if len(beat_times) < 2:
        return 0.0
    
    # Calculate intervals between consecutive beats
    intervals = np.diff(beat_times)
    
    if len(intervals) == 0:
        return 0.0
    
    # Calculate coefficient of variation (lower is better)
    mean_interval = np.mean(intervals)
    std_interval = np.std(intervals)
    
    if mean_interval == 0:
        return 0.0
    
    cv = std_interval / mean_interval
    
    # Convert to confidence score (0-1)
    # cv of 0 = perfect (confidence 1.0)
    # cv of 0.5 or higher = poor (confidence approaches 0)
    confidence = max(0.0, min(1.0, 1.0 - (cv * 2)))
    
    return confidence


def analyze_video_audio(video_path):
    """
    Complete audio analysis pipeline for a video file.
    
    This is the main entry point that:
    1. Extracts audio from video
    2. Detects beats and estimates BPM
    3. Cleans up temporary files
    
    Args:
        video_path: Path to the video file
        
    Returns:
        dict with analysis results (bpm, beat_timestamps, confidence)
    """
    audio_path = None
    
    try:
        # Extract audio
        print(f"Extracting audio from {video_path}...")
        audio_path = extract_audio_from_video(video_path)
        
        # Analyze audio
        print("Analyzing audio for beats and BPM...")
        results = detect_beats_and_bpm(audio_path)
        
        print(f"Analysis complete: BPM={results['bpm']:.2f}, "
              f"Beats={results['total_beats']}, "
              f"Confidence={results['confidence']:.2f}")
        
        return results
        
    finally:
        # Clean up temporary audio file
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
                print(f"Cleaned up temporary audio file: {audio_path}")
            except Exception as e:
                print(f"Warning: Could not remove temporary file {audio_path}: {e}")


def refine_beat_detection(audio_path, initial_bpm, beat_timestamps):
    """
    Refine beat detection using the initial BPM estimate.
    
    This can be used to improve beat detection by using the estimated BPM
    as a prior for a second pass of beat tracking.
    
    Args:
        audio_path: Path to the audio file
        initial_bpm: Initial BPM estimate
        beat_timestamps: Initial beat timestamps
        
    Returns:
        dict with refined results
    """
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        
        # Second pass with tighter constraints
        tempo, beat_frames = librosa.beat.beat_track(
            y=y,
            sr=sr,
            units='frames',
            start_bpm=initial_bpm,
            tightness=200  # Stricter adherence to tempo
        )
        
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        confidence = calculate_beat_confidence(beat_times, tempo)
        
        return {
            'bpm': float(tempo),
            'beat_timestamps': beat_times.tolist(),
            'confidence': confidence,
            'total_beats': len(beat_times)
        }
        
    except Exception as e:
        raise Exception(f'Failed to refine beat detection: {str(e)}')
