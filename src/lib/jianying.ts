// ===== 去剪映编辑：把片段按顺序写成剪映专业版（macOS，VideoFusion 11.x）的草稿文件夹，然后用 videocut:// 唤起剪映 =====
// 草稿格式照着竞品留在本机的草稿与剪映自己的备份反推：文件夹里放 draft_info.json（时间线）、draft_meta_info.json（索引）、
// draft_settings、draft_agency_config.json 和 videos/*.mp4（相对路径）。剪映打开时会把文件夹改名成草稿名、重新分配 id、写进总索引并加密重存。
// 浏览器里用 File System Access API 直接写进 ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft（第一次选一次目录并授权），
// 不支持的浏览器退化成下载一个 zip，解压到那个目录即可。
import { createStore, get as idbGet, set as idbSet } from 'idb-keyval';
import { getBlob, downloadBlob } from './storage';
import { readLedger } from './ledger';
import { useFiles, findMedia } from './store';
import { projects } from './projects';

export interface DraftClip { name: string; path: string; durationUs: number; width: number; height: number; }
export interface DraftSpec { name: string; clips: DraftClip[]; fps?: number; }
export interface DraftFiles { folder: string; info: string; meta: string; settings: string; agency: string; }

const HEX = '0123456789ABCDEF';
const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().toUpperCase();
  return [8, 4, 4, 4, 12].map(n => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('')).join('-');
};
const PLATFORM = { app_id: 8700, app_source: '', app_version: '10.5.0', device_id: '', hard_disk_id: '', mac_address: '', os: 'web', os_version: '' };

// 时间线：一条视频轨，片段首尾相接；每段带剪映要求的四个附属材料（画布 / 变速 / 声道 / 人声分离）
export function buildDraftJson(spec: DraftSpec, now = Date.now()): { info: any; meta: any; settings: string; agency: string; draftId: string } {
  const draftId = uid(); const fps = spec.fps || 30;
  const first = spec.clips[0]; const width = first?.width || 1920, height = first?.height || 1080;
  const videos: any[] = [], canvases: any[] = [], speeds: any[] = [], channels: any[] = [], vocals: any[] = [], segments: any[] = [];
  let cursor = 0;
  for (const c of spec.clips) {
    const mid = uid(), canvasId = uid(), speedId = uid(), channelId = uid(), vocalId = uid();
    videos.push({ aigc_history_id: '', aigc_item_id: '', aigc_type: 'none', audio_fade: null, cartoon_path: '', category_id: '', category_name: '', check_flag: 63487,
      crop: { lower_left_x: 0, lower_left_y: 1, lower_right_x: 1, lower_right_y: 1, upper_left_x: 0, upper_left_y: 0, upper_right_x: 1, upper_right_y: 0 }, crop_ratio: 'free', crop_scale: 1,
      duration: c.durationUs, extra_type_option: 0, formula_id: '', freeze: null, has_audio: true, height: c.height, id: mid, intensifies_audio_path: '', intensifies_path: '', is_ai_generate_content: false, is_copyright: true, is_text_edit_overdub: false, is_unified_beauty_mode: false,
      local_id: '', local_material_id: '', material_id: '', material_name: c.name, material_url: '', matting: { flag: 0, has_use_quick_brush: false, has_use_quick_eraser: false, interactiveTime: [], path: '', strokes: [] }, media_path: '', object_locked: null, origin_material_id: '',
      path: c.path, picture_from: 'none', picture_set_category_id: '', picture_set_category_name: '', request_id: '', reverse_intensifies_path: '', reverse_path: '', smart_match_info: { is_hd: false, query: '', type: 0 }, smart_motion: null, source: 0, source_platform: 0,
      stable: { matrix_path: '', stable_level: 0, time_range: { duration: 0, start: 0 } }, team_id: '', type: 'video', video_algorithm: { algorithms: [], complement_frame_config: null, deflicker: null, gameplay_configs: [], motion_blur_config: null, noise_reduction: null, path: '', quality_enhance: null, time_range: null }, width: c.width });
    canvases.push({ album_image: '', blur: 0.5, color: '', id: canvasId, image: '', image_id: '', image_name: '', source_platform: 0, team_id: '', type: 'canvas_blur' });
    speeds.push({ curve_speed: null, id: speedId, mode: 0, speed: 1, type: 'speed' });
    channels.push({ audio_channel_mapping: 0, id: channelId, is_config_open: false, type: '' });
    vocals.push({ choice: 0, id: vocalId, production_path: '', time_range: null, type: 'vocal_separation' });
    segments.push({ caption_info: null, cartoon: false, clip: { alpha: 1, flip: { horizontal: false, vertical: false }, rotation: 0, scale: { x: 1, y: 1 }, transform: { x: 0, y: 0 } }, common_keyframes: [], enable_adjust: true, enable_color_correct_adjust: false, enable_color_curves: true, enable_color_match_adjust: false, enable_color_wheels: true, enable_lut: true, enable_smart_color_adjust: false,
      extra_material_refs: [speedId, canvasId, channelId, vocalId], group_id: '', hdr_settings: { intensity: 1, mode: 1, nits: 1000 }, id: uid(), intensifies_audio: false, is_placeholder: false, is_tone_modify: false, keyframe_refs: [], last_nonzero_volume: 1, material_id: mid, render_index: 0,
      responsive_layout: { enable: false, horizontal_pos_layout: 0, size_layout: 0, target_follow: '', vertical_pos_layout: 0 }, reverse: false, source_timerange: { duration: c.durationUs, start: 0 }, speed: 1, target_timerange: { duration: c.durationUs, start: cursor }, template_id: '', template_scene: 'default', track_attribute: 0, track_render_index: 0, uniform_scale: { on: true, value: 1 }, visible: true, volume: 1 });
    cursor += c.durationUs;
  }
  const emptyGroups = ['ai_translates', 'audio_balances', 'audio_effects', 'audio_fades', 'audio_track_indexes', 'audios', 'beats', 'chromas', 'color_curves', 'digital_humans', 'drafts', 'effects', 'flowers', 'green_screens', 'handwrites', 'hsl', 'images', 'log_color_wheels', 'loudnesses', 'manual_deformations', 'masks', 'material_animations', 'material_colors', 'multi_language_refs', 'placeholders', 'plugin_effects', 'primary_color_wheels', 'realtime_denoises', 'shapes', 'smart_crops', 'smart_relights', 'stickers', 'tail_leaders', 'text_templates', 'texts', 'time_marks', 'transitions', 'video_effects', 'video_trackings', 'vocal_beautifys'];
  const materials: Record<string, any[]> = Object.fromEntries(emptyGroups.map(k => [k, []]));
  Object.assign(materials, { canvases, sound_channel_mappings: channels, speeds, videos, vocal_separations: vocals });
  const sec = Math.floor(now / 1000);
  const info = {
    canvas_config: { background: null, height, ratio: 'custom', width }, color_space: -1,
    config: { adjust_max_index: 1, attachment_info: [], combination_max_index: 1, export_range: null, extract_audio_last_index: 1, lyrics_recognition_id: '', lyrics_sync: true, lyrics_taskinfo: [], maintrack_adsorb: true, material_save_mode: 0, multi_language_current: 'none', multi_language_list: [], multi_language_main: 'none', multi_language_mode: 'none', original_sound_last_index: 1, record_audio_last_index: 1, sticker_max_index: 1, subtitle_keywords_config: null, subtitle_recognition_id: '', subtitle_sync: true, subtitle_taskinfo: [], system_font_list: [], video_mute: false, zoom_info_params: null },
    cover: null, create_time: sec, duration: cursor, extra_info: null, fps, free_render_index_mode_on: false, group_container: null, id: draftId, keyframe_graph_list: [],
    keyframes: { adjusts: [], audios: [], effects: [], filters: [], handwrites: [], stickers: [], texts: [], videos: [] }, last_modified_platform: PLATFORM, materials, mutable_config: null, name: spec.name, new_version: '111.0.0', platform: PLATFORM,
    relationships: [], render_index_track_mode_on: true, retouch_cover: null, source: 'default', static_cover_image_path: '', time_marks: null,
    tracks: [{ attribute: 0, flag: 0, id: uid(), is_default_name: true, name: '', segments, type: 'video' }], update_time: sec, version: 360000,
  };
  const meta = {
    cloud_draft_cover: false, cloud_draft_sync: false, draft_cover: 'draft_cover.jpg', draft_fold_path: '', draft_id: draftId, draft_is_ai_shorts: false, draft_is_cloud_temp_draft: false, draft_is_infinite_canvas_draft: false, draft_is_invisible: false,
    draft_materials: [{ type: 0, value: spec.clips.map(c => ({ create_time: 0, duration: c.durationUs, extra_info: c.name, file_Path: './' + c.path, height: c.height, id: uid(), import_time: sec, import_time_ms: -1, item_source: 1, md5: '', metetype: 'video', roughcut_time_range: { duration: -1, start: -1 }, sub_time_range: { duration: -1, start: -1 }, type: 0, width: c.width })) }],
    draft_materials_copied_info: [], draft_name: spec.name, draft_new_version: '', draft_removable_storage_device: '', draft_root_path: '', draft_segment_extra_info: [], draft_timeline_materials_size_: 0, draft_type: '',
    tm_draft_cloud_completed: '', tm_draft_cloud_entry_id: -1, tm_draft_cloud_modified: 0, tm_draft_cloud_parent_entry_id: -1, tm_draft_cloud_space_id: -1, tm_draft_cloud_user_id: -1, tm_draft_create: now * 1000, tm_draft_modified: now * 1000, tm_draft_removed: 0, tm_duration: cursor,
  };
  const settings = `[General]\ndraft_create_time=${sec}\ndraft_last_edit_time=${sec}\n`;
  const agency = JSON.stringify({ is_auto_agency_enabled: false, is_auto_agency_popup: false, is_single_agency_mode: false, marterials: null, use_converter: false, video_resolution: Math.min(height, width) >= 1080 ? 1080 : 720 });
  return { info, meta, settings, agency, draftId };
}
export const EMPTY_DIRS = ['Resources', 'Timelines', 'adjust_mask', 'audios', 'common_attachment', 'matting', 'qr_upload', 'smart_crop', 'subdraft'];
export const safeFolderName = (name: string) => String(name || '草稿').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || '草稿';

// ---- 片段来源：台账里按序号排好的片段（成片就是它们拼的），没有台账时就是这一条视频本身 ----
export function collectClipIds(mediaId?: string): string[] {
  const ledger = readLedger();
  const fromLedger = (ledger?.clips || []).filter(c => c.mediaId && findMedia(c.mediaId)).sort((a, b) => a.no - b.no).map(c => c.mediaId!);
  const target = mediaId ? findMedia(mediaId) : null;
  if (target && target.model !== '本地合成' && !fromLedger.includes(target.id)) return [target.id];   // 单独一段视频就导它自己
  return fromLedger.length ? fromLedger : target ? [target.id] : [];
}
function probeVideo(blob: Blob): Promise<{ durationUs: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob); const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.src = url;
    const done = (d: number) => { URL.revokeObjectURL(url); resolve({ durationUs: Math.round(d * 1e6), width: v.videoWidth || 1920, height: v.videoHeight || 1080 }); };
    v.onloadedmetadata = () => { if (isFinite(v.duration) && v.duration > 0) done(v.duration); else { v.ontimeupdate = () => { v.ontimeupdate = null; done(isFinite(v.duration) ? v.duration : 0); }; v.currentTime = 1e6; } };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('视频无法解码')); };
  });
}

// ---- 目录授权：记住用户选过的 com.lveditor.draft 目录 ----
const settingsStore = createStore('moodio-settings', 'kv');
const DIR_KEY = 'jianying-drafts-dir';
type DirHandle = FileSystemDirectoryHandle & { queryPermission?: (o: { mode: string }) => Promise<string>; requestPermission?: (o: { mode: string }) => Promise<string> };
export const canWriteDirectly = () => typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
async function pickDraftsDir(force = false): Promise<DirHandle> {
  let handle = force ? null : await idbGet<DirHandle>(DIR_KEY, settingsStore).catch(() => null);
  if (handle) {
    const q = await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'prompt');
    if (q !== 'granted') { const r = await handle.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied'); if (r !== 'granted') handle = null; }
  }
  if (!handle) {
    handle = await (window as any).showDirectoryPicker({ id: 'jianying-drafts', mode: 'readwrite', startIn: 'videos' }) as DirHandle;
    await idbSet(DIR_KEY, handle, settingsStore).catch(() => {});
  }
  return handle;
}
async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close();
}

// ---- 主流程 ----
export interface ExportResult { mode: 'direct' | 'zip'; folder: string; clips: number; opened: boolean; }
export async function exportToJianying(mediaId?: string, onProgress?: (t: string) => void): Promise<ExportResult> {
  const ids = collectClipIds(mediaId); if (!ids.length) throw new Error('没有可导出的片段');
  const title = projects.active().title || '创作'; const folder = safeFolderName(`${title} · Moodio`);
  onProgress?.('读取片段…');
  const clips: DraftClip[] = []; const blobs: Blob[] = [];
  for (let i = 0; i < ids.length; i++) {
    const m = findMedia(ids[i])!; const blob = await getBlob(m.id); if (!blob) throw new Error(`「${m.name}」的文件不在本机媒体库里`);
    const p = await probeVideo(blob); const ext = (m.mime.split('/')[1] || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 4) || 'mp4';
    clips.push({ name: m.name, path: `videos/clip_${String(i + 1).padStart(2, '0')}.${ext}`, durationUs: p.durationUs, width: p.width, height: p.height }); blobs.push(blob);
  }
  const d = buildDraftJson({ name: folder, clips });
  const files: [string, string][] = [['draft_info.json', JSON.stringify(d.info)], ['draft_meta_info.json', JSON.stringify(d.meta)], ['draft_settings', d.settings], ['draft_agency_config.json', d.agency]];
  if (canWriteDirectly()) {
    onProgress?.('写入剪映草稿目录…');
    const root = await pickDraftsDir();
    if (root.name !== 'com.lveditor.draft') throw new Error(`选的目录是「${root.name}」，请选剪映的草稿目录 Movies/JianyingPro/User Data/Projects/com.lveditor.draft`);
    let name = folder; for (let n = 2; ; n++) { try { await root.getDirectoryHandle(name); name = `${folder} ${n}`; } catch { break; } }
    const dir = await root.getDirectoryHandle(name, { create: true });
    const videos = await dir.getDirectoryHandle('videos', { create: true });
    for (let i = 0; i < clips.length; i++) { onProgress?.(`复制片段 ${i + 1}/${clips.length}…`); await writeFile(videos, clips[i].path.slice('videos/'.length), blobs[i]); }
    for (const [n, text] of files) await writeFile(dir, n, text);
    for (const sub of EMPTY_DIRS) await dir.getDirectoryHandle(sub, { create: true });
    let opened = false; try { window.location.href = 'videocut://'; opened = true; } catch { /* 没装剪映或浏览器拦了 */ }
    return { mode: 'direct', folder: name, clips: clips.length, opened };
  }
  onProgress?.('打包草稿…');
  const entries: { path: string; data: Uint8Array }[] = [];
  for (const [n, text] of files) entries.push({ path: `${folder}/${n}`, data: new TextEncoder().encode(text) });
  for (let i = 0; i < clips.length; i++) entries.push({ path: `${folder}/${clips[i].path}`, data: new Uint8Array(await blobs[i].arrayBuffer()) });
  for (const sub of EMPTY_DIRS) entries.push({ path: `${folder}/${sub}/`, data: new Uint8Array(0) });
  downloadBlob(`${folder}.zip`, makeZip(entries));
  return { mode: 'zip', folder, clips: clips.length, opened: false };
}

// ---- 不压缩的 zip（store），够剪映解压用；避免引依赖 ----
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(data: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function makeZip(entries: { path: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff]; const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  for (const e of entries) {
    const name = enc.encode(e.path); const crc = crc32(e.data); const size = e.data.length;
    const local = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...name]);
    parts.push(local, e.data);
    central.push(new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + size;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, end] as BlobPart[], { type: 'application/zip' });
}
