import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { getRegionLabel } from '../../utils/bodyRegions';
import { useTheme } from '../../hooks/useTheme';

interface BodyMapProps { selected: string[]; onToggle: (regionId: string) => void; }
type BodyView = 'front' | 'back';
type HitBox = { x: number; y: number; w: number; h: number; priority?: number };
type Region = { id: string; hit: HitBox; d?: string; ellipse?: { cx: number; cy: number; rx: number; ry: number } };
const VIEW_W = 260; const VIEW_H = 520; const SVG_H = 440;
const FRONT_OUTLINE = 'M130 13 C112 13 101 27 101 49 C101 67 109 80 117 86 C115 96 110 101 100 105 C86 108 69 112 56 121 C48 127 43 139 40 155 C36 180 34 203 31 226 C28 246 23 264 18 281 C15 292 18 302 27 307 C36 312 44 305 47 294 C52 277 56 260 60 243 C64 229 68 218 72 210 C78 231 80 249 78 267 C76 284 70 301 68 319 C66 340 69 360 74 380 C78 397 79 414 76 432 C73 449 70 466 70 480 C69 491 75 498 86 499 C97 500 104 493 104 482 C104 467 106 453 110 439 C114 421 117 401 119 381 C122 358 125 337 128 320 L130 306 L132 320 C135 337 138 358 141 381 C143 401 146 421 150 439 C154 453 156 467 156 482 C156 493 163 500 174 499 C185 498 191 491 190 480 C190 466 187 449 184 432 C181 414 182 397 186 380 C191 360 194 340 192 319 C190 301 184 284 182 267 C180 249 182 231 188 210 C192 218 196 229 200 243 C204 260 208 277 213 294 C216 305 224 312 233 307 C242 302 245 292 242 281 C237 264 232 246 229 226 C226 203 224 180 220 155 C217 139 212 127 204 121 C191 112 174 108 160 105 C150 101 145 96 143 86 C151 80 159 67 159 49 C159 27 148 13 130 13 Z';
const BACK_OUTLINE = FRONT_OUTLINE;
const limb = (id:string,x:number,y:number,w:number,h:number,d:string,p=8):Region=>({id,hit:{x,y,w,h,priority:p},d});
const FRONT_REGIONS: Region[] = [
{id:'face',hit:{x:104,y:22,w:52,h:62,priority:10},ellipse:{cx:130,cy:51,rx:22,ry:28}},
{id:'head',hit:{x:98,y:8,w:64,h:82,priority:7},ellipse:{cx:130,cy:49,rx:29,ry:36}},
limb('neck',104,80,52,32,'M116 82 C118 94 113 102 105 106 L155 106 C147 102 142 94 144 82 Z',10),
limb('shoulder_left',41,103,67,53,'M103 105 C84 107 67 112 55 122 C49 129 45 139 43 151 C55 152 68 151 79 148 C84 130 91 116 103 108 Z',9),
limb('shoulder_right',152,103,67,53,'M157 105 C176 107 193 112 205 122 C211 129 215 139 217 151 C205 152 192 151 181 148 C176 130 169 116 157 108 Z',9),
limb('chest_left',82,108,49,66,'M92 113 C103 108 116 106 129 106 L129 169 C116 171 103 169 92 165 C87 151 84 135 84 121 Z'),
limb('chest_right',129,108,49,66,'M131 106 C144 106 157 108 168 113 L176 121 C176 135 173 151 168 165 C157 169 144 171 131 169 Z'),
limb('upper_abdomen',90,162,80,61,'M93 166 C105 170 117 172 130 172 C143 172 155 170 167 166 C164 185 164 199 167 211 C155 218 143 221 130 221 C117 221 105 218 93 211 C96 199 96 185 93 166 Z'),
limb('lower_abdomen',90,207,80,61,'M93 211 C105 218 117 221 130 221 C143 221 155 218 167 211 C169 228 167 242 161 255 C151 262 141 265 130 265 C119 265 109 262 99 255 C93 242 91 228 93 211 Z'),
limb('hip_left',84,249,44,56,'M99 253 C90 260 86 271 87 285 C94 295 106 301 121 301 L125 265 C114 264 106 260 99 253 Z',9),
limb('hip_right',132,249,44,56,'M161 253 C170 260 174 271 173 285 C166 295 154 301 139 301 L135 265 C146 264 154 260 161 253 Z',9),
limb('upper_arm_left',35,141,48,98,'M47 146 C41 165 39 185 39 202 C39 214 40 225 43 235 L59 232 C60 216 62 200 65 184 C68 169 73 156 79 147 Z'),
{id:'elbow_left',hit:{x:31,y:226,w:30,h:31,priority:10},ellipse:{cx:45,cy:241,rx:12,ry:13}},
limb('forearm_left',26,249,38,80,'M41 253 C38 271 34 287 30 302 C27 313 30 322 36 324 C43 326 49 320 51 311 C55 291 59 271 59 253 Z'),
limb('hand_left',17,315,36,45,'M29 319 C21 326 18 337 22 347 C25 355 32 358 39 353 C45 349 48 339 46 326 Z',10),
limb('upper_arm_right',177,141,48,98,'M213 146 C219 165 221 185 221 202 C221 214 220 225 217 235 L201 232 C200 216 198 200 195 184 C192 169 187 156 181 147 Z'),
{id:'elbow_right',hit:{x:199,y:226,w:30,h:31,priority:10},ellipse:{cx:215,cy:241,rx:12,ry:13}},
limb('forearm_right',196,249,38,80,'M219 253 C222 271 226 287 230 302 C233 313 230 322 224 324 C217 326 211 320 209 311 C205 291 201 271 201 253 Z'),
limb('hand_right',207,315,36,45,'M231 319 C239 326 242 337 238 347 C235 355 228 358 221 353 C215 349 212 339 214 326 Z',10),
limb('thigh_left',82,282,45,109,'M89 287 C84 308 84 330 87 352 C89 366 92 378 98 387 L121 382 C120 362 121 343 124 323 C126 311 126 302 123 297 C110 297 99 293 89 287 Z'),
{id:'knee_left',hit:{x:87,y:376,w:37,h:38,priority:10},ellipse:{cx:105,cy:395,rx:15,ry:16}},
limb('lower_leg_left',84,406,38,64,'M94 411 C93 432 90 450 87 467 L112 467 C116 449 118 430 118 411 Z'),
limb('ankle_left',82,461,34,22,'M87 465 L112 465 L111 480 L87 480 Z',10),
limb('foot_left',71,474,46,31,'M87 478 C79 486 73 492 75 497 C77 502 84 503 94 501 L113 498 L111 478 Z',10),
limb('thigh_right',133,282,45,109,'M171 287 C176 308 176 330 173 352 C171 366 168 378 162 387 L139 382 C140 362 139 343 136 323 C134 311 134 302 137 297 C150 297 161 293 171 287 Z'),
{id:'knee_right',hit:{x:136,y:376,w:37,h:38,priority:10},ellipse:{cx:155,cy:395,rx:15,ry:16}},
limb('lower_leg_right',138,406,38,64,'M166 411 C167 432 170 450 173 467 L148 467 C144 449 142 430 142 411 Z'),
limb('ankle_right',144,461,34,22,'M173 465 L148 465 L149 480 L173 480 Z',10),
limb('foot_right',143,474,46,31,'M173 478 C181 486 187 492 185 497 C183 502 176 503 166 501 L147 498 L149 478 Z',10),
];
const BACK_REGIONS:Region[] = FRONT_REGIONS.filter(r=>r.id!=='face'&&!r.id.startsWith('chest')&&!r.id.includes('abdomen')&&!r.id.startsWith('hip_')).concat([
limb('shoulder_blade_left',82,108,48,70,'M91 113 C102 108 114 106 129 106 L129 174 C116 174 104 170 94 164 C89 148 87 130 91 113 Z'),
limb('shoulder_blade_right',130,108,48,70,'M131 106 C146 106 158 108 169 113 C173 130 171 148 166 164 C156 170 144 174 131 174 Z'),
limb('mid_back',88,166,84,69,'M94 165 C105 171 117 174 130 174 C143 174 155 171 166 165 C164 184 164 202 168 216 C156 224 143 228 130 228 C117 228 104 224 92 216 C96 202 96 184 94 165 Z'),
limb('lower_back_left',87,214,43,57,'M92 216 C103 224 115 228 129 228 L126 267 C113 267 103 263 95 256 C91 242 90 229 92 216 Z'),
limb('lower_back_right',130,214,43,57,'M131 228 C145 228 157 224 168 216 C170 229 169 242 165 256 C157 263 147 267 134 267 Z'),
limb('glute_left',84,250,47,61,'M95 255 C87 263 84 276 87 290 C95 301 108 307 127 307 L126 267 C113 267 103 263 95 255 Z'),
limb('glute_right',129,250,47,61,'M165 255 C173 263 176 276 173 290 C165 301 152 307 133 307 L134 267 C147 267 157 263 165 255 Z'),
]);
export function BodyMap({selected,onToggle}:BodyMapProps){
 const theme=useTheme(); const [view,setView]=useState<BodyView>('front'); const [width,setWidth]=useState(0); const regions=view==='front'?FRONT_REGIONS:BACK_REGIONS; const outline=view==='front'?FRONT_OUTLINE:BACK_OUTLINE; const selectedLabels=selected.map(getRegionLabel).join(', ');
 const scale=Math.min(width/VIEW_W,SVG_H/VIEW_H); const offsetX=(width-VIEW_W*scale)/2; const offsetY=(SVG_H-VIEW_H*scale)/2;
 const boxFor=(hit:HitBox)=>({left:offsetX+hit.x*scale,top:offsetY+hit.y*scale,width:hit.w*scale,height:hit.h*scale,zIndex:hit.priority??1});
 const styles=useMemo(()=>StyleSheet.create({container:{gap:theme.spacing.md},toggle:{flexDirection:'row',alignSelf:'center',backgroundColor:theme.colors.surfaceMuted,borderRadius:theme.radius.pill,padding:4,gap:4},toggleButton:{minWidth:92,minHeight:40,paddingHorizontal:theme.spacing.lg,alignItems:'center',justifyContent:'center',borderRadius:theme.radius.pill},toggleButtonSelected:{backgroundColor:theme.colors.primary},toggleText:{...theme.typography.caption,fontFamily:theme.fonts.semibold,color:theme.colors.inkSecondary},toggleTextSelected:{color:theme.colors.onPrimary},diagramWrap:{position:'relative',minHeight:SVG_H},hitTarget:{position:'absolute',backgroundColor:'transparent'},hint:{...theme.typography.caption,textAlign:'center'},selectedText:{...theme.typography.bodySecondary,fontFamily:theme.fonts.semibold,color:theme.colors.primary,textAlign:'center'},emptyText:{...theme.typography.bodySecondary,color:theme.colors.inkMuted,textAlign:'center'}}),[theme]);
 return <View style={styles.container}><View style={styles.toggle}>{(['front','back'] as const).map(option=><Pressable key={option} onPress={()=>setView(option)} accessibilityRole="button" accessibilityState={{selected:view===option}} style={[styles.toggleButton,view===option&&styles.toggleButtonSelected]}><Text style={[styles.toggleText,view===option&&styles.toggleTextSelected]}>{option==='front'?'Front':'Back'}</Text></Pressable>)}</View><View style={styles.diagramWrap} onLayout={(e:LayoutChangeEvent)=>setWidth(e.nativeEvent.layout.width)}><Svg width="100%" height={SVG_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}><Path d={outline} fill={theme.colors.surfaceMuted} stroke={theme.colors.border} strokeWidth={1.5}/>{regions.map(region=>{if(!selected.includes(region.id))return null;const common={fill:theme.colors.primary,stroke:theme.colors.primaryPressed,strokeWidth:2.2,opacity:0.9};return region.ellipse?<Ellipse key={region.id} {...region.ellipse} {...common}/>:region.d?<Path key={region.id} d={region.d} {...common}/>:null;})}</Svg>{width>0&&regions.map(region=><Pressable key={region.id} onPress={()=>onToggle(region.id)} accessibilityRole="button" accessibilityState={{selected:selected.includes(region.id)}} accessibilityLabel={getRegionLabel(region.id)} style={[styles.hitTarget,boxFor(region.hit)]}/>)}</View><Text style={styles.hint}>{view==='front'?'Front view':'Back view'} — tap the area that applies.</Text>{selected.length>0?<Text style={styles.selectedText}>Selected: {selectedLabels}</Text>:<Text style={styles.emptyText}>No areas selected yet.</Text>}</View>;
}
