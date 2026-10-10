import PDFDocument from 'pdfkit'
import path from 'node:path'
import { buildReportModel, candidateSetName, REPORT_LABELS } from '../shared/report-model.js'
import { analyzeReport } from '../shared/report-analysis.js'

const C={ink:'#183744',muted:'#687d87',teal:'#247e82',navy:'#173e51',gold:'#b28a46',paper:'#f7f9fa',grid:'#d9e5e9',soft:'#e9f2f2',white:'#ffffff'}
const COLORS=[C.teal,'#8c689f',C.gold,'#3d799e','#ad7182','#598b68']
const date=ts=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(ts)
const short=(s,n)=>s.length>n?s.slice(0,n)+'…':s

/** Editorial report with measured text blocks, vector artwork and account-derived commentary. */
export function createReportPdf(history,account,language='zh') {
  language=language==='en'?'en':'zh'
  const en=language==='en',t=(zh,english)=>en?english:zh,m=buildReportModel(history,account,language),a=analyzeReport(m,language)
  const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{Title:t('灵性探索 · 个人报告','Spirituality exploration · Personal report'),Author:'Spirituality Lab'}})
  doc.registerFont('CJK',path.resolve('public/fonts/NotoSansSC-Regular.otf')).font('CJK')
  const chunks=[],done=new Promise((resolve,reject)=>{doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)})
  function height(text,width,size=10){doc.fontSize(size);return doc.heightOfString(String(text),{width,lineGap:4})}
  function write(text,x,y,width=511,size=10,color=C.ink,align='left') {
    doc.fillOpacity(1).fillColor(color).fontSize(size).text(String(text),x,y,{width,lineGap:4,align})
    return y+height(text,width,size)
  }
  const line=(x1,y1,x2,y2,color=C.grid,width=1)=>doc.moveTo(x1,y1).lineTo(x2,y2).strokeColor(color).lineWidth(width).stroke()
  function background(){doc.rect(0,0,596,842).fill(C.paper);doc.rect(0,0,596,5).fill(C.teal)}
  function page(title,kicker,subtitle){
    doc.addPage();background()
    write('LING / RARICY',42,30,220,9,C.teal)
    write(date(Date.now()),350,30,203,9,C.muted,'right')
    write(kicker,42,68,511,9,C.gold)
    let y=write(title,42,89,511,26,C.ink)+15
    if(subtitle)y=write(subtitle,42,y,511,10,C.muted)+16
    line(42,y,553,y)
    return y+24
  }
  function panel(x,y,w,h,tone=C.white){doc.roundedRect(x,y,w,h,12).fill(tone)}
  function cardHeight(title,body,w,{tag='',small=false}={}) {
    const titleH=height(title,w-42,small?11:13),bodyH=height(body,w-42,small?9:10)
    return 22+titleH+9+bodyH+20+(tag?height(tag,w-42,8)+9:0)
  }
  function card(title,body,x,y,w,options={}){
    const {accent=C.teal,tag='',small=false}=options,h=Math.max(options.minHeight||0,cardHeight(title,body,w,options))
    panel(x,y,w,h);doc.roundedRect(x,y+16,3,h-32,1).fill(accent)
    let yy=write(title,x+21,y+18,w-42,small?11:13,accent)+9
    yy=write(body,x+21,yy,w-42,small?9:10,C.ink)
    if(tag)write(tag,x+21,yy+9,w-42,8,C.muted)
    return y+h
  }

  // Cover: a quiet constellation, spacious typography and a personalized profile.
  background();doc.rect(0,0,596,392).fill(C.navy)
  const g=doc.linearGradient(0,0,596,392);g.stop(0,C.navy).stop(1,'#245f69');doc.rect(0,0,596,392).fill(g)
  write('LING / RARICY',42,35,280,10,'#b9d6da')
  write(t('灵性探索','SPIRITUALITY'),42,93,355,en?32:39,C.white)
  write(t('个人观察与分析报告','PERSONAL OBSERVATIONS & ANALYSIS'),42,en?148:157,370,en?12:21,'#d6e7e8')
  write(account.username,42,234,325,14,C.white)
  write(`${date(Date.now())}  /  ${t('账号记录生成','BASED ON ACCOUNT RECORDS')}`,42,268,340,9,'#b9d6da')
  doc.save();doc.strokeOpacity(.3)
  doc.ellipse(478,188,94,70).rotate(-27,{origin:[478,188]}).strokeColor('#b9d6da').lineWidth(.8).stroke()
  doc.restore();doc.save();doc.strokeOpacity(.25);doc.circle(478,188,83).strokeColor('#b9d6da').lineWidth(.6).stroke();doc.restore()
  const stars=[[429,148],[497,123],[522,198],[483,235],[445,198]]
  for(let i=0;i<stars.length;i++){const p=stars[i],q=stars[(i+1)%stars.length];line(...p,...q,'#91bbc1',.7);doc.circle(...p,i===2?4:2.5).fill(i===2?'#dfc295':'#dae9e9')}
  write(t('每一场记录，都让画像更清晰。','Every observation adds detail to your story.'),42,340,430,11,'#d6e7e8')
  const profileH=Math.max(190,115+height(a.profile.description,469,11))
  panel(42,428,511,profileH)
  write(t('你的探索画像','YOUR EXPLORATION PROFILE'),63,450,469,9,C.gold)
  write(a.profile.label,63,479,469,23,C.ink)
  write(a.profile.description,63,524,469,11,C.muted)
  write(t('读懂自己的直觉，也看见人与人之间的默契。','Explore your intuition and the connections you share.'),42,428+profileH+23,511,11,C.teal)

  let y=page(t('一眼看懂你的探索','Your exploration at a glance'),'01 / PERSONAL INSIGHTS',t('把数据放回个人经历：哪些方向已经积累，近期发生了什么变化。','Put observations in context: your focus, recent changes and paired experience.'))
  const recent=a.trends.find(tr=>tr.key==='dses'&&tr.direction!=='insufficient')||a.trends.find(tr=>tr.direction!=='insufficient')
  const insights=[
    {title:t('把这些表现放在一起看','What your observations say together'),body:a.synthesis?.text||a.profile.description},
    {title:recent?.direction==='up'?t('近期变化 · 正在上升','Recent change · Rising'):recent?.direction==='down'?t('近期变化 · 有所回落','Recent change · A quieter phase'):t('近期变化 · 持续观察','Recent change · Keep observing'),body:recent?.text||t('你的时间线还在铺开，现在更值得记住的是每次选择时的感受：是迅速闪过的念头，还是反复斟酌后的答案？继续留下几次相同设置的记录，报告就能把这些片段连成一条变化的线。下一次不必刻意追求突破，按平常的方式完成即可。','Your timeline is still taking shape. Notice how a choice arrives: as a quick impression or after careful thought. A few more sessions under the same settings will connect those moments into a clearer story. For your next session, use your usual approach without trying to force a breakthrough.')},
    {title:t('你的共鸣搭档','Your agreement partner'),body:a.partner.text},
  ]
  for(const insight of insights){if(y+cardHeight(insight.title,insight.body,511)>740)y=page(t('个人分析（续）','Personal insights continued'),'01 / PERSONAL INSIGHTS');y=card(insight.title,insight.body,42,y,511)+15}

  y=page(t('你的多维画像','Your dimension profile'),'02 / DIMENSION MAP',t('观察四种不同的表现，找到下一步值得探索的方向。','Four distinct observations help you choose what to explore next.'))
  const cx=204,cy=y+174,radius=95
  const point=(i,r)=>[cx+Math.cos(-Math.PI/2+i*Math.PI/2)*r,cy+Math.sin(-Math.PI/2+i*Math.PI/2)*r]
  for(let level=1;level<=5;level++){const p=[0,1,2,3].map(i=>point(i,radius*level/5));doc.moveTo(...p[0]);p.slice(1).forEach(v=>doc.lineTo(...v));doc.closePath().strokeColor(C.grid).lineWidth(.8).stroke();write(String(level*20),cx+4,cy-radius*level/5-10,27,7,C.muted)}
  if(m.dimensions.every(d=>d.value!==null)){const p=m.dimensions.map((d,i)=>point(i,radius*d.value/100));doc.moveTo(...p[0]);p.slice(1).forEach(v=>doc.lineTo(...v));doc.closePath().fillOpacity(.16).fillAndStroke(C.teal,C.teal).fillOpacity(1)}
  const axisLocations=[{x:114,y:cy-radius-42,w:180,a:'center'},{x:cx+radius+10,y:cy-10,w:61,a:'left'},{x:114,y:cy+radius+20,w:180,a:'center'},{x:42,y:cy-15,w:cx-radius-52,a:'right'}]
  m.dimensions.forEach((d,i)=>{const p=point(i,radius);line(cx,cy,...p,C.grid,.8);const l=axisLocations[i];write(d.label,l.x,l.y,l.w,9,C.ink,l.a);if(d.value!==null){const v=point(i,radius*d.value/100);doc.circle(...v,3.5).fill(C.teal)}})
  m.dimensions.forEach((d,i)=>{const top=y+i*82;panel(379,top,174,72);write(d.label,394,top+10,144,9,C.muted);write(d.value==null?t('暂无数据','No data'):`${d.value.toFixed(1)}%`,394,top+28,144,d.value==null?14:20,COLORS[i]);write(d.key==='dses'?(d.mean==null?'':`mean ${d.mean.toFixed(2)} / 6`):`n = ${d.n}`,394,top+55,144,8,C.muted)})
  y+=370
  y=card(t('你的四个探索方向','Your four directions of exploration'),t('感知与预知，记录你独自面对未知时的选择；双人测验，描绘你与搭档的默契；日常体验，则把注意力带回生活。把这张图看作一张探索地图：已经展开的地方值得继续走，留白的地方也可以成为下一段旅程。','Perception and precognition follow your choices when you face the unknown alone. Paired trials explore the agreement you share, while daily experience brings attention back to everyday life. Read this as a map: developed areas invite another visit, and open spaces offer somewhere new to explore.'),42,y,511,{accent:C.gold})+18
  write(t('每个实验轴使用最近有数据的协议与符号组，汇总该组；问卷使用最近一份完整记录。','Each experiment axis aggregates its most recently used protocol and symbol group. DSES uses the latest complete record.'),42,y,511,9,C.muted)

  y=page(t('逐维解读与分类','Dimension-by-dimension interpretation'),'03 / PERFORMANCE PATTERNS',t('看看你在哪些地方已有亮点，又有哪些方向正在展开。','Find the highlights in your exploration and the areas still taking shape.'))
  for(let i=0;i<a.dimensions.length;i+=2){
    const row=a.dimensions.slice(i,i+2).map((review,j)=>({review,title:`0${i+j+1}  ${review.label}\n${review.verdict}`}))
    const rowH=Math.max(...row.map(item=>cardHeight(item.title,item.review.text,248,{small:true})))
    if(y+rowH>740)y=page(t('逐维解读（续）','Dimension interpretation continued'),'03 / PERFORMANCE PATTERNS')
    row.forEach((item,j)=>card(item.title,item.review.text,42+j*263,y,248,{small:true,minHeight:rowH,accent:COLORS[i+j]}))
    y+=rowH+16
  }

  const batches=m.peers.length?Array.from({length:Math.ceil(m.peers.length/8)},(_,i)=>m.peers.slice(i*8,i*8+8)):[[]]
  for(let batch=0;batch<batches.length;batch++){
    y=page(t('谁与你更有默契','Your paired connections'),'04 / RELATIONSHIP MAP',t('连线代表共同实验，粗细代表有效回合数；只展示你自己的关系。','Edges represent shared trials; width reflects valid rounds. Only your own pairs appear.'))
    y=card(t('把共同经历画成一张图','A map of shared exploration'),m.peers.length?t('每一次共同完成的实验，都让你与搭档之间多留下一段记录。在这里，你可以看到曾经一起探索过的人，也可以从熟悉的名字出发，挑一位再约一次双人测验。','Each shared session adds a record between you and a partner. Here you can revisit the people you have explored with and choose a familiar name for another paired session.'):t('这里还在等待你的第一位搭档。邀请一个人和你共同完成测验，关系图就会从你出发，添上第一条连线。','This map is waiting for your first partner. Complete a shared session to add the first connection from you.'),42,y,511,{small:true})+18
    const peers=batches[batch],gx=298,gy=y+155
    peers.forEach((p,i)=>{const angle=-Math.PI/2+i*2*Math.PI/peers.length,x=gx+Math.cos(angle)*173,yy=gy+Math.sin(angle)*125
      line(gx,gy,x,yy,C.grid,Math.min(4.5,1+Math.sqrt(p.n)/5));doc.circle(x,yy,18).fill(C.soft);doc.circle(x,yy,4).fill(C.teal)
      write(short(p.label,10),x-63,yy+23,126,9,C.ink,'center')
      write(p.n?`${(p.correct/p.n*100).toFixed(1)}% / n=${p.n}`:t('暂无有效回合','No valid rounds'),x-63,yy+40,126,8,C.muted,'center')
    })
    doc.circle(gx,gy,30).fill(C.teal);write(short(account.username,9),gx-52,gy-9,104,9,C.white,'center')
    if(!peers.length)write(t('完成双人实验后，在这里生成你的配对网络。','Complete paired trials to start your relationship map.'),70,gy+70,455,11,C.muted,'center')
    y=gy+194
    write(t('从你出发，每条线都连接一位共同探索过的搭档。线越厚，留下的共同记录越多。','Every line begins with you and reaches a person you have explored with. Thicker lines hold more shared observations.'),42,y,511,9,C.muted)
  }

  // Measured panels keep commentary above the chart and dates outside the plot.
  let trendY=page(t('你的变化轨迹','Your trajectory over time'),'05 / LONGITUDINAL VIEW',t('每个点代表一场实验或完整问卷，按真实时间间隔绘制。','Each point represents an experiment or complete questionnaire, positioned by actual time.'))
  const seriesList=m.series.length?m.series:[{label:t('等待第一份记录','Awaiting your first record'),points:[]}]
  for(let index=0;index<seriesList.length;index++){
    const series=seriesList[index],review=a.trends.find(r=>series.label===r.label||series.label.startsWith(r.label+' /'))
    // Commentary only applies to the currently selected group; other groups remain descriptive.
    const selected=series.label===m.dimensions.find(d=>d.key==='dses').label||m.dimensions.some(d=>d.group && m.groups.find(g=>g.key===d.group)?.points===series.points)
    const commentary=selected&&review?review.text:t('这一段时间线保留了你在另一组设置中的探索。可以沿着曲线，回想每次测试时采用的节奏，再与现在的记录对照。','This timeline preserves your exploration with another set of settings. Follow the curve, recall the approach you used, and compare that chapter with your current observations.')
    const titleH=height(series.label,465,12),commentH=height(commentary,465,9),cardH=titleH+commentH+163
    if(trendY+cardH>735)trendY=page(t('变化轨迹（续）','Trajectory continued'),'05 / LONGITUDINAL VIEW')
    panel(42,trendY,511,cardH)
    let top=write(series.label,65,trendY+16,465,12,COLORS[index%COLORS.length])+7
    top=write(commentary,65,top,465,9,C.muted)+16
    const left=83,width=444,h=76
    for(let tick=0;tick<=100;tick+=50){const yy=top+h-tick/100*h;line(left,yy,left+width,yy,C.grid,.6);write(String(tick),55,yy-6,21,7,C.muted,'right')}
    const times=series.points.map(p=>p.time),min=Math.min(...times),max=Math.max(...times)
    const points=series.points.map(p=>({x:left+(max===min?width/2:(p.time-min)/(max-min)*width),y:top+h-p.value/100*h}))
    if(points.length>1){doc.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>doc.lineTo(p.x,p.y));doc.strokeColor(COLORS[index%COLORS.length]).lineWidth(1.7).stroke()}
    points.forEach(p=>doc.circle(p.x,p.y,3).fill(COLORS[index%COLORS.length]))
    if(times.length){write(date(min),left,top+h+10,170,8,C.muted);write(date(max),left+width-170,top+h+10,170,8,C.muted,'right')}
    else write(t('完成测验后开始绘制','Complete a test to start this chart'),left,top+25,width,10,C.muted,'center')
    trendY+=cardH+17
  }

  y=page(t('你的下一步','Your next steps'),'06 / PERSONAL EXPLORATION PLAN',t('让下一份记录更有信息量，也让长期变化更容易理解。','Make the next observation more informative and long-term changes easier to interpret.'))
  a.guidance.forEach((tip,i)=>{const title=`${String(i+1).padStart(2,'0')}  ${t('探索建议','Exploration step')}`;if(y+cardHeight(title,tip,511)>740)y=page(t('下一步（续）','Next steps continued'),'06 / PERSONAL EXPLORATION PLAN');y=card(title,tip,42,y,511,{accent:i%2?C.gold:C.teal})+15})

  y=page(t('记录依据与阅读说明','Your records and reading notes'),'07 / READING NOTES',t('需要了解计算细节时，可以在这里查看。','The details behind your charts and commentary.'))
  for(const group of m.groups){if(y+48>730)y=page(t('实验数据（续）','Experiment data continued'),'07 / TRANSPARENCY');const name=candidateSetName(group.candidateSet,language)
    panel(42,y,511,39);write(`${REPORT_LABELS[language][group.type]} / v${group.version} / ${name}`,57,y+11,325,9,C.ink);write(`${group.correct}/${group.n} · ${group.n?(group.correct/group.n*100).toFixed(1)+'%':'—'}`,390,y+11,148,9,C.teal,'right');y+=48}
  const notes=[
    a.profile.evidence,
    t('探索类型依次依据四维覆盖、早期记录量、双人参与比例、完整问卷数量和单项集中度。实验维度满 20 回合后进行分类；单人命中率与 20% 参考线比较，差异在 ±5 个百分点内归为“平稳探索”。','Exploration profiles consider coverage, early record count, paired participation, complete questionnaires and single-task concentration. Dimension descriptions begin at 20 rounds. Solo rates within 5 percentage points of the 20% reference fall into the steady-exploration category.'),
    t('趋势需要至少 3 份同组记录，比较最早和最近各 min(3, floor(记录数/2)) 份，窗口不重叠。实验每窗口至少 10 回合，按回合加权；DSES 按完整问卷均值。展示变化超过 5 个百分点才称上升／回落。','Trends require 3 comparable records. Compare the first and last min(3, floor(record count / 2)) records without overlap. Experiment windows need 10 rounds each and use round weights; DSES uses complete-questionnaire means. Changes exceeding 5 display points are described as rising or falling.'),
    t('搭档评语比较当前双人协议与符号组下、至少 10 回合的登录搭档；网络汇总本人配对记录，匿名搭档每场独立。双人自由选择没有固定机会基线。', 'Partner commentary compares signed-in partners with at least 10 rounds under the current protocol and symbols. The network summarizes your pairs, with anonymous partners kept separate by session. Free-choice pairs have no fixed chance baseline.'),
    a.partner.detail,
    ...a.trends.filter(tr=>tr.detail).map(tr=>`${tr.label}：${tr.detail}`),
    t('DSES 按 Underwood 2022 计分；完整问卷均值以 (mean−1)/5×100 绘图。均值 ≥4、≥2.5 与较低值分别对应频繁、偶尔和较少。雷达图的各轴含义不同，实验使用最近有记录的协议与符号组，问卷使用最近完整记录；留白不补零，也不合成总分。','DSES uses Underwood 2022 scoring; complete means are plotted as (mean−1)/5×100. Means ≥4, ≥2.5 and lower values correspond to frequent, occasional and less frequent experience. Radar axes measure different things. Experiments use the latest recorded protocol and symbols; DSES uses the latest complete record. Missing axes stay empty and no composite score is calculated.'),
    'DSES: https://www.dsescale.org/  |  OAuth: github.com/raricycms/raricy.com/blob/main/docs/oauth.md',
    t('阅读说明：本报告依据测验和自述记录作探索性解读，分类与评语不代表经过验证的灵性能力或超自然能力；中文 DSES 为网页翻译，未经量表效度验证。','Reading note: This report offers an exploratory interpretation of test and self-reported records. Its profiles and commentary do not establish validated spiritual or paranormal abilities. The Chinese DSES is a web translation and has not undergone scale validation.'),
  ]
  y+=10
  for(const note of notes){const h=height(note,511,9);if(y+h>738)y=page(t('分析方法（续）','Analysis methods continued'),'07 / TRANSPARENCY');y=write(note,42,y,511,9,C.muted)+16}
  const pages=doc.bufferedPageRange()
  for(let i=0;i<pages.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;line(42,785,553,785,C.grid,.6);write('LING / RARICY · '+t('个人记录','PERSONAL OBSERVATIONS'),42,801,360,7,C.muted);write(`${String(i+1).padStart(2,'0')} / ${String(pages.count).padStart(2,'0')}`,440,800,113,8,C.teal,'right');doc.page.margins.bottom=bottom}
  doc.end();return done
}
