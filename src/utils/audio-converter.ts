/**
 * Audio Converter Utility
 * Converts MP3 to PCM16 format for OpenAI Realtime API
 * 
 * Realtime API expects:
 * - Format: PCM16
 * - Sample Rate: 24kHz
 * - Channels: Mono (1)
 * - Bit Depth: 16-bit
 */

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

// Try to use ffmpeg from npm package
try {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  ffmpeg.setFfmpegPath(ffmpegPath);
} catch (error) {
  console.warn('FFmpeg installer not found, using system ffmpeg');
}

export interface AudioConversionOptions {
  sampleRate?: number;  // Default: 24000 (24kHz for Realtime API)
  channels?: number;    // Default: 1 (mono)
  bitDepth?: number;    // Default: 16
}

/**
 * Convert MP3 to PCM16 format
 */
export async function convertMP3toPCM16(
  inputPath: string,
  outputPath: string,
  options: AudioConversionOptions = {}
): Promise<Buffer> {
  const {
    sampleRate = 24000,  // 24kHz for Realtime API
    channels = 1,        // Mono
    bitDepth = 16,       // 16-bit
  } = options;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    ffmpeg(inputPath)
      .outputFormat('s16le')  // Signed 16-bit little-endian PCM
      .audioChannels(channels)
      .audioFrequency(sampleRate)
      .audioBitrate(`${bitDepth}k`)
      .on('error', (error) => {
        reject(new Error(`Audio conversion failed: ${error.message}`));
      })
      .on('end', () => {
        const pcmBuffer = Buffer.concat(chunks);
        
        // Save to file if output path provided
        if (outputPath) {
          fs.writeFileSync(outputPath, pcmBuffer);
        }
        
        resolve(pcmBuffer);
      })
      .pipe()
      .on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
  });
}

/**
 * Convert audio buffer in memory (MP3 → PCM16)
 */
export async function convertAudioBuffer(
  mp3Buffer: Buffer,
  options: AudioConversionOptions = {}
): Promise<Buffer> {
  const {
    sampleRate = 24000,
    channels = 1,
    bitDepth = 16,
  } = options;

  // Create temp files
  const tempDir = path.join(process.cwd(), '.temp-audio');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempInput = path.join(tempDir, `input-${Date.now()}.mp3`);
  const tempOutput = path.join(tempDir, `output-${Date.now()}.pcm`);

  try {
    // Write MP3 to temp file
    fs.writeFileSync(tempInput, mp3Buffer);

    // Convert
    const pcmBuffer = await convertMP3toPCM16(tempInput, tempOutput, options);

    // Cleanup temp files
    fs.unlinkSync(tempInput);
    fs.unlinkSync(tempOutput);

    return pcmBuffer;
  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    throw error;
  }
}

/**
 * Get audio info
 */
export async function getAudioInfo(filePath: string): Promise<{
  format: string;
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      if (!audioStream) {
        reject(new Error('No audio stream found'));
        return;
      }

      resolve({
        format: audioStream.codec_name || 'unknown',
        duration: metadata.format.duration || 0,
        sampleRate: audioStream.sample_rate ? parseInt(audioStream.sample_rate as any) : 0,
        channels: audioStream.channels || 0,
        bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate as any) : 0,
      });
    });
  });
}


