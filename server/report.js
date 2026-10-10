import PDFDocument from 'pdfkit'
import path from 'node:path'
import { buildReportModel, candidateSetName, REPORT_LABELS } from '../shared/report-model.js'
import { analyzeReport } from '../shared/report-analysis.js'
import { nekoCopy } from '../shared/report-copy.js'

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
  const paragraphs=text=>String(text).split(/\n{2,}/)
  function height(text,width,size=10){
    doc.fontSize(size)
    const blocks=paragraphs(text)
    return blocks.reduce((total,block)=>total+doc.heightOfString(block,{width,lineGap:4}),0)+Math.max(0,blocks.length-1)*8
  }
  function write(text,x,y,width=511,size=10,color=C.ink,align='left') {
    let cursor=y
    const blocks=paragraphs(text)
    blocks.forEach((block,index)=>{
      doc.fillOpacity(1).fillColor(color).fontSize(size).text(block,x,cursor,{width,lineGap:4,align})
      cursor+=height(block,width,size)+(index<blocks.length-1?8:0)
    })
    return cursor
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

  // Neko keeps the supplied portrait intact, with its own space beside the title.
  background()
  const coverTop=355,g=doc.linearGradient(0,0,596,coverTop)
  g.stop(0,C.navy).stop(1,'#245f69');doc.rect(0,0,596,coverTop).fill(g)
  write('LING / RARICY',42,35,280,10,'#b9d6da')
  let coverY=write(t('灵性探索','Spirituality\nexploration'),42,85,270,en?29:36,C.white)+15
  coverY=write(t('Neko 的个人探索报告',"Your exploration with Neko"),42,coverY,270,13,'#d6e7e8')+25
  coverY=write(short(account.username,28),42,coverY,270,14,C.white)+9
  write(date(Date.now()),42,coverY,270,9,'#b9d6da')
  doc.roundedRect(354,62,199,242,12).fill('#d6e7e8')
  doc.image(path.resolve('public/images/neko.png'),360,68,{fit:[187,218],align:'center',valign:'center'})
  write('Neko',360,286,187,9,C.navy,'center')
  const profileY=386,profileH=Math.max(210,114+height(a.profile.description,469,10))
  panel(42,profileY,511,profileH)
  write(t('你的探索画像','Your exploration profile'),63,profileY+20,469,9,C.gold)
  let profileTextY=write(a.profile.label,63,profileY+45,469,23,C.ink)+14
  write(a.profile.description,63,profileTextY,469,10,C.muted)

  let y=page(t('一眼看懂你的探索','Your exploration at a glance'),'01 / PERSONAL INSIGHTS',nekoCopy('report_intro',en))
  const recent=a.trends.find(tr=>tr.key==='dses'&&tr.direction!=='insufficient')||a.trends.find(tr=>tr.direction!=='insufficient')
  const insights=[
    {title:t('把这些表现放在一起看','What your observations say together'),body:a.synthesis?.text||a.profile.description},
    {title:recent?.direction==='up'?t('近期变化 · 正在上升','Recent change · Rising'):recent?.direction==='down'?t('近期变化 · 有所回落','Recent change · A quieter phase'):t('近期变化 · 持续观察','Recent change · Keep observing'),body:recent?.text||nekoCopy('recent_pending',en)},
    {title:t('你的共鸣搭档','Your agreement partner')+(a.partner.leaders?.length?'\n'+a.partner.leaders.map(p=>short(p.label,24)).slice(0,3).join(' / '):''),body:a.partner.text},
  ]
  for(const insight of insights){if(y+cardHeight(insight.title,insight.body,511)>740)y=page(t('个人分析（续）','Personal insights continued'),'01 / PERSONAL INSIGHTS');y=card(insight.title,insight.body,42,y,511)+15}

  y=page(t('你的多维画像','Your dimension profile'),'02 / DIMENSION MAP',t('这张图把你的四个探索方向放在一起，哪里已经留下足迹，哪里还等着出发，都能看见。Neko 陪你挑一条想继续的小路喵。',"Here's your map, meow. See where you've spent time and where you still have room to try something new. Neko can help you pick a path you'd like to revisit."))
  const cx=204,cy=y+174,radius=95
  const point=(i,r)=>[cx+Math.cos(-Math.PI/2+i*Math.PI/2)*r,cy+Math.sin(-Math.PI/2+i*Math.PI/2)*r]
  for(let level=1;level<=5;level++){const p=[0,1,2,3].map(i=>point(i,radius*level/5));doc.moveTo(...p[0]);p.slice(1).forEach(v=>doc.lineTo(...v));doc.closePath().strokeColor(C.grid).lineWidth(.8).stroke();write(String(level*20),cx+4,cy-radius*level/5-10,27,7,C.muted)}
  if(m.dimensions.every(d=>d.value!==null)){const p=m.dimensions.map((d,i)=>point(i,radius*d.value/100));doc.moveTo(...p[0]);p.slice(1).forEach(v=>doc.lineTo(...v));doc.closePath().fillOpacity(.16).fillAndStroke(C.teal,C.teal).fillOpacity(1)}
  const axisLocations=[{x:114,y:cy-radius-42,w:180,a:'center'},{x:cx+radius+10,y:cy-10,w:61,a:'left'},{x:114,y:cy+radius+20,w:180,a:'center'},{x:42,y:cy-15,w:cx-radius-52,a:'right'}]
  m.dimensions.forEach((d,i)=>{const p=point(i,radius);line(cx,cy,...p,C.grid,.8);const l=axisLocations[i];write(d.label,l.x,l.y,l.w,9,C.ink,l.a);if(d.value!==null){const v=point(i,radius*d.value/100);doc.circle(...v,3.5).fill(C.teal)}})
  m.dimensions.forEach((d,i)=>{const top=y+i*82;panel(379,top,174,72);write(d.label,394,top+10,144,9,C.muted);write(d.value==null?t('暂无数据','No data'):`${d.value.toFixed(1)}%`,394,top+28,144,d.value==null?14:20,COLORS[i]);write(d.key==='dses'?(d.mean==null?'':`mean ${d.mean.toFixed(2)} / 6`):`n = ${d.n}`,394,top+55,144,8,C.muted)})
  // The last sidebar ends 318 pt below its start; leave one clean text gap.
  y+=336
  const radarBody=nekoCopy('radar_guide',en)
  if(y+cardHeight(t('你的四个探索方向','Your four directions of exploration'),radarBody,511)+height(nekoCopy('radar_note',en),511,9)+32>740)y=page(t('探索地图的读法','Reading your exploration map'),'02 / DIMENSION MAP')
  y=card(t('你的四个探索方向','Your four directions of exploration'),radarBody,42,y,511,{accent:C.gold})+18
  write(nekoCopy('radar_note',en),42,y,511,9,C.muted)

  y=page(t('逐维解读与分类','Dimension-by-dimension interpretation'),'03 / PERFORMANCE PATTERNS',t('接下来，我们把每个方向单独翻开看看。Neko 会聊聊已经出现的亮点，也给刚起步的地方留一点耐心，看看哪段最让你好奇。',"Let's look at each direction on its own. Neko will point out the highlights and give the newer chapters time to grow. See which part makes you want to try again."))
  for(let i=0;i<a.dimensions.length;i+=2){
    const row=a.dimensions.slice(i,i+2).map((review,j)=>({review,title:`0${i+j+1}  ${review.label}\n${review.verdict}`}))
    const rowH=Math.max(...row.map(item=>cardHeight(item.title,item.review.text,248,{small:true})))
    if(y+rowH>740)y=page(t('逐维解读（续）','Dimension interpretation continued'),'03 / PERFORMANCE PATTERNS')
    row.forEach((item,j)=>card(item.title,item.review.text,42+j*263,y,248,{small:true,minHeight:rowH,accent:COLORS[i+j]}))
    y+=rowH+16
  }

  const batches=m.peers.length?Array.from({length:Math.ceil(m.peers.length/8)},(_,i)=>m.peers.slice(i*8,i*8+8)):[[]]
  for(let batch=0;batch<batches.length;batch++){
    y=page(t('谁与你更有默契','Your paired connections'),'04 / RELATIONSHIP MAP',t('这些连线连着陪你做过测验的人，线越粗，共同完成的有效回合越多。Neko 只翻你自己的记录，熟悉的名字都在这里喵。',"These lines connect you with people you've tested with. Thicker lines mean more valid shared rounds. Neko is looking only at your own records, so these are the names from your sessions."))
    y=card(t('把共同经历画成一张图','A map of shared exploration'),nekoCopy(m.peers.length?'network_intro':'network_empty',en),42,y,511,{small:true})+18
    const peers=batches[batch],caption=nekoCopy('network_caption',en),captionH=height(caption,511,9)
    if(y+253+captionH>738)y=page(t('你的搭档连线','Your partner connections'),'04 / RELATIONSHIP MAP')
    const radiusY=Math.min(125,(738-y-captionH-93)/2),gx=298,gy=y+radiusY+25
    peers.forEach((p,i)=>{const angle=-Math.PI/2+i*2*Math.PI/peers.length,x=gx+Math.cos(angle)*173,yy=gy+Math.sin(angle)*radiusY
      line(gx,gy,x,yy,C.grid,Math.min(4.5,1+Math.sqrt(p.n)/5));doc.circle(x,yy,18).fill(C.soft);doc.circle(x,yy,4).fill(C.teal)
      write(short(p.label,10),x-63,yy+23,126,9,C.ink,'center')
      write(p.n?`${(p.correct/p.n*100).toFixed(1)}% / n=${p.n}`:t('暂无有效回合','No valid rounds'),x-63,yy+40,126,8,C.muted,'center')
    })
    doc.circle(gx,gy,30).fill(C.teal);write(short(account.username,9),gx-52,gy-9,104,9,C.white,'center')
    if(!peers.length)write(nekoCopy('network_empty_caption',en),70,gy+62,455,9,C.muted,'center')
    y=gy+radiusY+68
    write(caption,42,y,511,9,C.muted)
  }

  // Measured panels keep commentary above the chart and dates outside the plot.
  let trendY=page(t('你的变化轨迹','Your trajectory over time'),'05 / LONGITUDINAL VIEW',t('把不同日期的记录连起来，起伏就有了前后文。每个点是一场实验或完整问卷，Neko 陪你沿着时间线慢慢看，找找最近的变化。',"The dates give these ups and downs some context. Each point is one experiment or complete questionnaire, with the gaps shown to scale. Neko will follow the line with you and look at what's changed lately."))
  const seriesList=m.series.length?m.series:[{label:t('等待第一份记录','Awaiting your first record'),points:[]}]
  for(let index=0;index<seriesList.length;index++){
    const series=seriesList[index],review=a.trends.find(r=>series.label===r.label||series.label.startsWith(r.label+' /'))
    // Commentary only applies to the currently selected group; other groups remain descriptive.
    const selected=series.label===m.dimensions.find(d=>d.key==='dses').label||m.dimensions.some(d=>d.group && m.groups.find(g=>g.key===d.group)?.points===series.points)
    const commentary=selected&&review?review.text:nekoCopy(series.points.length?'trend_other':'trend_empty',en)
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

  y=page(t('你的下一步','Your next steps'),'06 / PERSONAL EXPLORATION PLAN',t('看到这里，有没有哪一项让你还想再试一次？Neko 按你现在的记录写了几条建议，选一条顺手的就好，下次回来接着玩喵。',"Anything here make you want another go? Neko has a few suggestions based on your records. Pick one that sounds easy to try, and come back when you feel like playing again, meow."))
  a.guidance.forEach((tip,i)=>{const title=`${String(i+1).padStart(2,'0')}  ${t('探索建议','Exploration step')}`;if(y+cardHeight(title,tip,511)>740)y=page(t('下一步（续）','Next steps continued'),'06 / PERSONAL EXPLORATION PLAN');y=card(title,tip,42,y,511,{accent:i%2?C.gold:C.teal})+15})

  y=page(t('记录依据与阅读说明','Your records and reading notes'),'07 / READING NOTES',t('如果你想知道图表和评语是怎么算出来的，Neko 把用到的记录与规则放在这一页。平时可以先读故事，好奇时再回来查细节。',"Want to know how the charts and comments were worked out? Neko has put the records and rules here. You can read your story first and return to the details whenever you're curious."))
  for(const group of m.groups){if(y+48>730)y=page(t('实验数据（续）','Experiment data continued'),'07 / TRANSPARENCY');const name=candidateSetName(group.candidateSet,language)
    panel(42,y,511,39);write(`${REPORT_LABELS[language][group.type]} / v${group.version} / ${name}`,57,y+11,325,9,C.ink);write(`${group.correct}/${group.n} · ${group.n?(group.correct/group.n*100).toFixed(1)+'%':'—'}`,390,y+11,148,9,C.teal,'right');y+=48}
  const notes=[
    a.profile.evidence,
    nekoCopy('method_profile',en),
    nekoCopy('method_trend',en),
    nekoCopy('method_partner',en),
    a.partner.detail,
    ...a.trends.filter(tr=>tr.detail).map(tr=>`${tr.label}：${tr.detail}`),
    nekoCopy('method_dses',en),
    'DSES: https://www.dsescale.org/  |  OAuth: github.com/raricycms/raricy.com/blob/main/docs/oauth.md',
    nekoCopy('reading_note',en),
  ]
  y+=10
  for(const note of notes){const h=height(note,511,9);if(y+h>738)y=page(t('分析方法（续）','Analysis methods continued'),'07 / TRANSPARENCY');y=write(note,42,y,511,9,C.muted)+16}
  const pages=doc.bufferedPageRange()
  for(let i=0;i<pages.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;line(42,785,553,785,C.grid,.6);write('LING / RARICY · '+t('个人记录','PERSONAL OBSERVATIONS'),42,801,360,7,C.muted);write(`${String(i+1).padStart(2,'0')} / ${String(pages.count).padStart(2,'0')}`,440,800,113,8,C.teal,'right');doc.page.margins.bottom=bottom}
  doc.end();return done
}
