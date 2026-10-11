// English was rewritten first with humanize-ai-writing, then translated into
// short Chinese paragraphs. Each pair keeps the English draft beside its translation.
const copy = (en, zh) => ({ en, zh })
const read = (entry, en = false) => entry[en ? 'en' : 'zh'].join('\n\n')

const profiles = {
  multi: copy([
    "You've wandered through all four paths now! Neko has gathered your solo intuitions, paired sparks, and quiet daily ripples side by side—there's so much lovely stuff to curl up and revisit, meow~",
    "Next time, just pick the game you're in the mood for most. Stick with familiar settings for a couple of rounds, and only wander off when your whiskers tingle with curiosity. No need to rush through everything in one go!",
    "Comparing these trails is getting exciting: which curves are purring steadily along, and which are quietly shifting? Bring your next round back here, and Neko will see how it fits into your story!",
  ], [
    '四个方向你都已经走过一遍啦！Neko 把它们全都收拢在了一起——独自直觉、双人默契还有日常心境，每一块都有好多值得回头细看的小细节喵～',
    '下次不妨先挑一个最想玩的，用最顺手的设置连着试上几轮。等什么时候又好奇了，再去别的路上溜达，可不用一口气把所有东西都做完呀。',
    '现在慢慢对比起来可有意思了：哪些线一直稳稳当当，哪些线又在悄悄变化呢？等你带着新的记录回来，Neko 再陪你看看它和之前有什么不一样喵！',
  ]),
  early: copy([
    "We're just turning the first couple of pages together! Neko has already caught a few playful glimpses, and there are still plenty of little games waiting. Just start with whichever one catches your eye, meow~",
    "Notice how your choices surface, too. Does the answer jump right out, or do your paws hover before deciding? Keep that little feeling close—it's a fun secret to unpack after each round.",
    "Whenever you feel like another turn, Neko will be right here. A few more familiar sessions will give us lots more to purr about and help you find your favorite path forward!",
  ], [
    '我们的故事书才刚刚翻开前几页呢！Neko 已经抓到了几个可爱的小瞬间，还有好几种玩法正排着队等你。先挑最顺眼的那个，轻松玩起来就好喵～',
    '做选择的时候也可以悄悄留意自己：答案是一下子冒出来的，还是犹豫着看了好几遍才定下？做完之后，把这个微妙的小感觉留给自己回味吧。',
    '想玩的时候随时再回来转转，熟悉的记录多攒几张，我们就有更多悄悄话可以聊啦，你也会更清楚自己最想往哪个方向探索喵！',
  ]),
  pair: copy([
    "Your journal is full of paired adventures! You clearly love tossing two minds into the ring to see where your wavelengths collide. Neko has a little partner map all laid out for you, meow~",
    "Invite your favorite partner back with the same familiar symbols. Lock in your choices on your own, and save the chitchat for the grand reveal! Repeating that rhythm gives your bond a real story to compare.",
    "You can take turns as sender and receiver, too, or welcome someone new when curiosity strikes. Keep track of each setup so Neko can read back the unique spark of every duo later!",
  ], [
    '你的日记本里，双人默契占了超大的一块呢！两个人各自选好，再看心意会不会悄悄碰在一起，Neko 每次看揭晓都跟着屏住呼吸喵～',
    '下次再约那位老搭档，用同一套熟悉的符号玩几场吧。各自先选定，等全部翻开再热烈复盘，这样就能对比出你们越来越清晰的默契轨迹啦。',
    '交换一下发送者和接收者的角色也超有趣，或者想尝鲜时带个新朋友来玩。记清楚每次的规则，回头翻翻，就能读到每对组合不同的小故事喵！',
  ]),
  journal: copy([
    "Your record flows with the gentle rhythm of everyday life. Neko is keeping an eye on your questionnaire notes, letting this page breathe at the natural pace of your ordinary days, meow.",
    "Whenever you drop by for another entry, just feel into your recent mood as a whole. A sleepy quiet day or a chaotic sparkle doesn't have to speak for your entire week—just go with your gut.",
    "Let the past notes sit cozily beside the new ones. Over time, you'll see which feelings kept blooming and which stayed gently the same. There's zero rush to fill up the timeline!",
  ], [
    '你的足迹更多浸润在日常生活的点滴里。Neko 会陪着你的问卷回答，静静感受这些心绪的流动，这一页的节奏可以完全跟着你的生活慢调子走喵～',
    '下次填问卷时，回想一下最近这一整段日子的整体感受就好。不管是极其放空的一天，还是特别热闹的一天，都照真实感觉选，不用逼自己做总结。',
    '把旧问卷和新心境挨着放，慢慢你就能看清，哪些感觉常常溜进心里，哪些一直稳稳地陪伴着你。时间线一点点画，不急着一口气填满喵。',
  ]),
  focused: copy([
    "One game has clearly stolen your heart! You've spent so much quality time with it that Neko can easily trace its little peaks and gentle valleys. What a cozy anchor point to come home to, meow~",
    "Stick with your favorite symbols for another visit, and tune into how your gut makes each call. If you want to try something fresh, just tweak one small thing at a time so our charts stay nice and clear.",
    "Keep diving deep here, or peek outside for a breath of fresh air—it's totally up to you! Pick what genuinely calls to you; Neko will safely stash every single session.",
  ], [
    '你在其中一种玩法里留下了好深好深的脚印呢，探索有了专属的重心！Neko 正沿着这条线，专注地陪你看不同场次里起起落落的波澜喵～',
    '下次继续用你最顺手的那组符号，顺便体会一下每次按下选择时的直觉。想尝试新招也行，一次只动一个小细节，前后对比起来就会一目了然。',
    '是继续深挖这一条路，还是跳到别处尝个鲜，全凭你的兴致来！选你当下真正想再试一次的，Neko 都会把珍贵的回合为你好好存起来喵。',
  ]),
  steady: copy([
    "You're like a curious cat wandering through different rooms! You haven't fenced yourself into one corner, which gives Neko so many fun angles to examine separately. Follow whatever catches your eye, meow~",
    "For the next few rounds, try sticking to one cozy setup. That way, we can see how your focus shifts without untangling a knot of changes all at once. The other games will patiently wait!",
    "When you sneak back in, we'll see what held steady and what started dancing. It helps you pick your next adventure based on pure fun, rather than chasing a high score!",
  ], [
    '你像只轻快的小猫一样，在几个不同的玩法之间闲庭信步，没有把自己绑在单一路线上。Neko 会把每个方向分别展开，细细看它们留下的痕迹喵～',
    '接下来不妨挑一套顺手的固定设置，连着玩上几场。这样前后对比起来最干净清楚，不用一下面对太多变量，其他好玩的随时都能再回去嘛。',
    '等你再次溜达回来，我们一起瞧瞧哪些地方变了、哪些依然亲切。下一次想玩什么，跟着当下的心情选就好，完全不需要被分数追着跑喵！',
  ]),
}

const dimensions = {
  hidden: {
    above: ['感知亮点', 'Perception highlights', copy([
      "Your hidden-target choices landed on the mark way more often than chance! Neko is putting a bright, shiny bookmark right here—this is definitely a spot to revisit, meow~",
      "Next time, notice if the answer pops into your head in a flash or if you bounce between options. Keep the symbols the same, finish the whole set, and only then look back at your rhythm.",
      "Bring a few more rounds to this page! We'll see if that sharp spark keeps glowing or if it was just a concentrated burst in one visit. We have a fun mystery to chase now!",
    ], [
      '在寻找隐藏信息时，你的直觉命中参考线的次数明显超出了预期！Neko 赶紧先在这里夹一枚漂亮的书签，这绝对是个值得反复回味的小亮点喵～',
      '下次做选择时可以体会一下：答案是一闪而过的灵光，还是在几个选项间反复斟酌？用同一套符号完整玩完整轮，再去复盘刚才的节奏。',
      '多带几场记录回这页看看吧！我们能看清楚这份惊艳的感知力是会持续闪烁，还是某个特殊时段的灵感迸发。现在有个专属的小谜题可以追啦喵！',
    ])],
    near: ['平稳探索', 'Steady exploration', copy([
      "Your matches are resting right along the reference line. It's a nice, steady plateau, so Neko will keep this cozy baseline warm as a launching pad for your next check-in, meow.",
      "Stick with your go-to style for a whole session. Notice which calls felt instant and which made you pause for a second glance. You can chew on those little contrasts once the cards are revealed.",
      "A few more runs under the same conditions will show whether this line prefers to lounge here or stretch into new territory. A steady anchor page is super handy for spotting changes later!",
    ], [
      '你的命中率刚好温和地依偎在参考线附近，起伏非常平稳。Neko 会先把这段稳健的表现当作基准线存好，当作我们下次继续探索的舒服起点喵。',
      '试着用你最习惯的状态完整做完一场，感受一下哪些回合秒出决断、哪些又让你多看了一眼。等答案全翻开后，再去慢慢回味这点微妙的差别。',
      '在相同设置下再攒几局，就能看清这条线是喜欢一直静静待在这里，还是正酝酿着新的走向。平稳的基础在未来做对比时可是最有用的喵！',
    ])],
    below: ['换个节奏再试', 'Try a fresh pace', copy([
      "Matches were a bit quiet on this hidden-info trail. Neko suggests an easy, pressure-free restart: familiar symbols, a calm corner, and all the time you need to breathe through it, meow.",
      "If you fancy shaking things up, change just one tiny habit. Try taking a soft breath before picking, while keeping the symbols and round count exactly the same. Then review the whole story.",
      "Keep this chapter right next to the next one—misses included! Having both pages side by side is the only real way to spot what actually shifts when you take another leap.",
    ], [
      '这一阶段的隐藏感知稍微有些安静，和答案对上的次数偏少了一点。Neko 建议下一场从最放松的节奏开始：选熟悉的符号、找个不赶时间的角落，舒舒服服做完就好喵。',
      '想换个感觉的话，一次只改动一件小事就行。比如在点击前轻轻停顿呼吸一秒，其他设置全都不变，做完后再整体回看，思绪会清晰很多。',
      '把这回的记录和下回的一起留着，哪怕没猜中的轮次也一张不落。两页并排放在一起，Neko 才能陪你真正看懂节奏改变带来的奇妙差别喵！',
    ])],
  },
  precognition: {
    above: ['预知亮点', 'Precognition highlights', copy([
      "You called the future before the answers even existed, and this chapter is full of hits! Neko is tucking a bookmark here with glowing eyes—this timeline is worth another spin, meow~",
      "Notice that gut feeling right before you press submit. Keep your approach steady through the whole run, then compare notes with this session once all the future cards are drawn.",
      "Every complete run gives these sparks a richer backdrop. We'll be able to see if your timing always catches the future or if this was a rare magic hour. Keep your whiskers twitching!",
    ], [
      '在未来答案还没生成之前，你就已经先做出了感应，而且命中得相当惊艳！Neko 眼睛都亮了，赶紧在这页夹个特别书签，这个时空感超值得再玩一次喵～',
      '在最终按下确认的那一瞬间，留心一下那个念头是怎么浮现出来的。整场保持住这种微妙的心境，等结果揭晓后，再跟今天这份记录对照着看。',
      '每一次完整体验，都会给这些高光添上更丰富的前后文。我们能渐渐看清这是你随时能连接的节奏，还是某一时段的灵感奇迹，下次见分晓喵！',
    ])],
    near: ['平稳探索', 'Steady exploration', copy([
      "Your choices and future results are pacing each other right around the expected line. It's a clean, meditative rhythm: call it first, then sit back and watch what appears, meow.",
      "Keep riding that calm wave for another full run. Once a choice is locked in, let it rest and wait for the reveal. Neko will gladly curl up and read the whole journey with you afterward.",
      "A few more visits will weave these separate moments into a single thread. Then you can see if the curve holds its steady hum or darts off, with today's baseline safe in your pocket.",
    ], [
      '你的选择和随后的生成结果一直紧紧贴着参考线，节奏非常均匀。这项玩法的趣味本来就很简单纯粹：先感应、选定、然后安静等待未来展开喵～',
      '下一场也顺着这个舒服的节拍完整走完吧。提交之后就让直觉稳稳停在那儿，等全部揭开再复盘，Neko 会耐心地陪你读完每一轮的印记。',
      '再多来几次，这些零散的预感就能连成一条光滑的曲线。它会继续平缓舒展还是突然拐弯？到时把新图和今天这页叠在一起看就全明白啦喵！',
    ])],
    below: ['重新寻找节奏', 'Find your pace again', copy([
      "Your calls and the future outcomes crossed paths less often here. For your next turn, Neko sets one gentle rule: just finish a full round at whatever pace feels cozy and natural, meow.",
      "Keep the same symbols and a steady mindset. If a different hour of the day feels quieter and more focused, try playing then while leaving everything else untouched. Review only when finished!",
      "Keep both visits in your diary! That gives you tangible trails to compare next time, including the rounds that danced just out of reach. Every missed step has something to tell us.",
    ], [
      '在这段记录里，你的选择和未来的答案似乎擦肩而过了几次，对上的次数稍有些落后。下一场先别给自己压力，用最惬意的心情完整玩一局就好喵～',
      '符号和玩法都保持你最熟的形式，要是觉得换个精力充沛的时段更灵验，也可以挑个安静的时刻试试。其他设置先不动，做完再看，比较起来最纯粹。',
      '把这回和下回的档案都好好留在盒子里。哪怕是没有猜中的回合，也是拼图不可或缺的一块，下次再来，我们就能看清转机是从哪里悄悄萌芽的喵！',
    ])],
  },
  telepathy: {
    above: ['默契逐渐显现', 'Shared choices stand out', copy([
      "Matching choices fill at least half of your paired story! Neko can point right to the magical rounds where your minds bumped into the exact same symbol. This bond is calling for a rematch, meow~",
      "Bring that same partner back with your familiar symbols. Sender focuses in, receiver tunes in on their own—then talk all about what crossed your minds after the curtain falls!",
      "Try trading roles for the next run, too! Keep these shared visits clustered together, and we'll see whether that sweet harmony travels both ways across the bridge.",
    ], [
      '在你们的双人记录里，选到同一个答案的回合已经占了一半以上！Neko 能挑出好多轮你们心意撞个满怀的瞬间，这份默契真的太让人想继续探究啦喵～',
      '下次再把这位心有灵犀的搭档喊来，用熟悉的符号继续。发送方凝神定心，接收方独立感受，等全揭开后再痛痛快快聊聊当时脑海里浮现的画面！',
      '也可以换个位置，把发送者和接收者对调一下试试看。把两个人的共同记忆攒在一起，Neko 就能看出换个频道时，默契的火花是不是依然闪亮喵！',
    ])],
    below: ['默契仍在展开', 'Agreement is taking shape', copy([
      "Your choices leaned towards different paths this time around. Neko is treating this as the lovely prologue to your shared journey—give this duo another cozy run, meow!",
      "Keep the symbol set familiar. Sender locks in first, receiver feels out their own choice freely. Once revealed, dive into what lured each of you toward your different symbols—that's the best part!",
      "A few more sessions will paint a clearer picture of your connection. Swapping seats adds another fun dimension, while keeping the settings steady lets you watch your rhythm tune into each other.",
    ], [
      '这一阶段你和搭档各自走向了不同的选项，碰在一起的默契回合还没占到多数。Neko 已经把这一页好好压好角啦，把它当成你们双人冒险的开篇序章吧喵！',
      '保留熟悉的符号库，发送者先想好，接收者完全凭自己的心意去抓。揭晓的那一刻，互相聊聊“你刚才为什么会被那个符号吸引”，复盘过程往往超级好玩！',
      '多攒几场同台记录，两个人之间的那根心线就会越来越清晰。互换角色是个很棒的视角，不变的设置也能让你们回头看清彼此是怎样一步步找对波长的喵。',
    ])],
  },
  dses: {
    above: ['日常体验丰富', 'Frequent everyday experience', copy([
      "Your questionnaire reports show these subtle everyday touches blooming quite often. Neko reads this page as a cozy reflection of your daily life, filled with your own gentle meanings, meow.",
      "Next time you check in, reflect on this recent stretch of time as a whole. Savor those fleeting, deeply connected moments without feeling pressured to find a grand epiphany in every sunrise.",
      "Keep living at your own sweet pace and fill out another sheet whenever you like. A few visits will reveal whether these warm feelings stay frequent or ebb and flow over time.",
    ], [
      '在问卷里，你所记录的日常灵性与细腻体验相当充沛呢！Neko 会把这一页当成你生活日常的温润写照，带着你熟悉的那些感触慢慢读喵～',
      '下次再填的时候，依然去感受最近这一整段日子的心境。回味那些让你觉得与万物有所连接、心生感动的碎片就好，不用强求每天都过得惊心动魄。',
      '按你自己的舒服节奏好好生活，想记录的时候再来填一张。几张问卷叠在一起，就能看懂这些充实的感触是一直如影随形，还是随生活起伏泛起涟漪喵。',
    ])],
    near: ['体验间歇出现', 'Experience comes in moments', copy([
      "These little experiences peek into your answers every now and then. Neko loves letting this page unfold naturally; no need to chase down a cinematic event just to have something to say, meow.",
      "Next time, take in the whole recent chapter of your life. Trust your own feel of the questions and pick what resonates. A quiet, uneventful patch belongs in your story just as much!",
      "Gathering a few questionnaires will string those fleeting ripples into a real timeline. You can then look back and see which feelings grew closer and which kept their gentle distance.",
    ], [
      '这些微妙的心灵体验在你的回答里像小水花一样，时不时跳出来一下。Neko 觉得这样慢悠悠地记录最舒服了，完全不用刻意去追逐什么惊天动地的顿悟喵～',
      '下次回想时，把目光放宽到近期的整段生活，凭着直觉选最贴切的。偶尔有一段心境特别平静、不起波澜的日子，也坦坦荡荡地留下来，那也是最真实的你。',
      '多填几次之后，零零碎碎的小水花就会串成一条生活的时间线。回头翻看，你就能品出哪些触动悄悄变得频繁，哪些体验始终保持着淡淡的步调喵。',
    ])],
    below: ['安静的体验阶段', 'A quieter chapter', copy([
      "You reported these sensations less frequently in this questionnaire—a very peaceful, grounded chapter! Neko will keep this quiet page safe as our starting line for whatever comes next, meow.",
      "Stick with definitions that feel natural to you. There's never a need to stretch an ordinary day into a mystical event. Just look back over your recent days and pick what rings true.",
      "Come back whenever your mood invites you. Keeping this peaceful entry beside your next one will show whether this quiet space stays still or begins to hum with new energy.",
    ], [
      '在这次问卷里，这类体验显得相当安静，是一段很脚踏实地的日子呢。Neko 会把这页平平淡淡的空白妥善收好，把它当作观察未来的安静原点喵～',
      '用你最舒服的常识去理解每一个问题就好，完全不需要为了迎合选项去给生活生搬硬套特殊的意义。想想这阵子的日常，选最诚实的那个。',
      '跟着你的心境随时回来回访。把今天这份平淡与以后的答卷并排摆放，我们就能看清这片宁静的湖水是一直清澈见底，还是慢慢泛起了微澜喵。',
    ])],
  },
}

const dailyTrends = {
  up: copy([
    "Your everyday spiritual experiences have been sparkling more often lately! Neko can clearly see the recent entries arching above your earlier ones—a delightful upward stretch, meow~",
    "Keep reflecting on the whole season of your life. Savor the warm moments you want to tuck into your pocket, and let plain days just be plain days. You don't need a miracle every morning!",
    "Drop by whenever you're ready for another entry. The next questionnaire will let us see how this warm tide flows, with your earlier thoughts resting nearby for an easy look back.",
  ], [
    '你日常里的灵性体验近期明显丰富起来了呢！新填的答卷高高扬起在早先的记录之上，Neko 看着这条生活线欢快地往上翘，心里也痒痒的想陪你继续看喵～',
    '填写时继续把视线放在最近这阵子的整体感觉上，遇到心里想珍藏的瞬间就多留心一眼。普通的日子就平常过，不用每天都非得寻找什么顿悟。',
    '什么时候有表达欲了，就再来填一份。新答卷能告诉我们这股温暖的心绪会怎样流淌，旧回答也都在老地方，随时方便我们对比前后心境喵！',
  ]),
  stable: copy([
    "Your daily spiritual experiences have held a steady, gentle hum recently. Neko reads this as a smooth, harmonious stretch of your timeline with no jarring jumps between chapters, meow.",
    "Keep trusting that same inner compass. Familiar, grounded feelings belong on the page just as much as fireworks—a quiet life is rich with things worth keeping safe.",
    "When you check in again, lay your new reflections right next to these. You'll easily spot what still feels like home and what started shifting, using this steady stretch as your North Star.",
  ], [
    '你的日常灵性体验近来一直维持在一个很平稳的水位，问卷之间没有大起大落。Neko 把它读作一段风平浪静的生活小确幸，等你下次再来翻看喵～',
    '继续用你习惯的方式回溯近期感受就好，平实无华的体会一样非常珍贵。生活不需要天天上演戏剧性事件，哪怕只是淡淡的日常，记录下来也很有温度。',
    '以后把新的答卷叠在这次旁边，你一眼就能看出哪些感受依然亲切熟悉，哪些在暗暗萌动。这段平稳的日子，会是你未来最好用的情绪锚点喵。',
  ]),
  down: copy([
    "Your everyday spiritual experiences have been a bit quieter recently. The newer questionnaires outline a soft, grounded dip compared to earlier ones. Neko will keep both safe and sound, meow.",
    "When you fill out the next one, just embrace your recent mood as a whole. You don't have to scramble for explanations or fix anything—let this quiet valley just be itself.",
    "Later answers will show whether this line climbs back up or stays cozy in its calm rhythm. Keep each entry safe so our next report can read your whole personal song together!",
  ], [
    '最近这阵子，你在日常中的灵性体验似乎沉淀了下来，新的答卷比过去显得更安静内敛。Neko 会把低谷和高光都好好珍藏，让生活日记完整无缺喵。',
    '下次落笔时，依然只管感受当下的心境。完全不需要急着为这阵子的“安静”寻找原因或者感到焦虑，顺其自然地写下最真实的想法就好。',
    '往后的答卷会悄悄告诉我们，这条线会再次扬起微光，还是继续享受这片宁静。把每张都保管好，下次报告时，Neko 陪你读出完整的韵律喵！',
  ]),
}

const experimentTrends = {
  up: copy([
    "This path is clearly on the rise lately! Under identical conditions, your recent rounds hit the mark noticeably more often than the earlier ones. Neko has stamped a little paw print here, meow~",
    "Keep the symbols and your relaxed mindset steady for another run. Finish the whole batch before peeking at the score, then tuck this full record beside your past runs.",
    "Ride this wave with open curiosity! Every single session has its own personality, and the next few rounds will tell us whether this upward leap keeps sprinting or settles in.",
  ], [
    '这一条探索线最近正在昂首向上走呢！在相同的游戏设置下，近期命中的次数明显比早先多出不少。Neko 已经在这里踩了个兴奋的小爪印，等你下次继续喵～',
    '下一局继续保留熟悉的符号和心流状态，完整玩到底之后再去复盘。把整套表现放在前几场旁边，你会看清自己的手感是怎么一点点热起来的。',
    '带着纯粹的好奇心继续玩就好，不用担心发挥好坏，每一场都拥有它自己的生命。再来几次，我们就能见证这段上升是会继续冲刺，还是平稳过渡喵！',
  ]),
  stable: copy([
    "This path has been coasting right along the same plateau. Neko will save this smooth curve as a cozy reference line for whenever you return with your favorite settings, meow.",
    "Stick with your current groove if it feels good, or try twitching an ear and changing one tiny detail while leaving everything else locked down.",
    "Always play the full session to the end! That way, whenever a fresh shift happens down the road, it will have these calm baseline rounds to sit beside. We'll easily see what moved!",
  ], [
    '这个方向近来没有大起大落，表现一直稳稳停留在相近的水平。Neko 会把这段四平八稳的曲线存好，作为你下次换上熟悉设置时的参照坐标喵～',
    '要是当下的手感正顺，就按老方法再试几局；要是手痒想尝鲜，也可以轻轻动一个小设置，其余保持原样，这样微调的效果才最容易辨认。',
    '每次都记得完整测完一整场哦！这样未来某天直觉突然发生跃迁时，前头才能有这些沉稳的脚印作对比。我们能一眼看出是哪里悄然蜕变了喵！',
  ]),
  down: copy([
    "This path has dipped a little recently, with fewer matches in your newer runs. Neko will cradle this little valley gently—next time, we start from a super cozy, zero-pressure space, meow.",
    "Stick to settings you know like the back of your paw and play through without stress. Tune into your inner rhythm while making choices, and resist the urge to overthink every miss afterward.",
    "A few more sessions will give this quiet dip its proper context. We'll find out whether your curve bounces back, stays steady, or turns somewhere new. Every page belongs in the book!",
  ], [
    '这一项最近的表现稍微回落了一些，新玩的几局和答案撞上的几率少了点。Neko 会温柔地接住这段下沉的曲线，下一场，我们从最没负担的节奏重新出发喵～',
    '用你闭着眼都熟悉的设置完整打完一局，做选择时顺便感受一下心跳的节拍。结束了就坦然看一眼，没必要急着去复盘每一个擦肩而过的失误。',
    '再多玩几把，这个小低谷就有了更丰富的前后对照。我们会一起见证曲线是重新反弹、就此抚平、还是拐向未知的惊喜。今天的失落也是珍贵的伏笔喵！',
  ]),
}

const partners = {
  empty: copy([
    "Your partner tapestry needs a few more shared threads before Neko can spotlight your strongest bond! Invite someone you'd love to explore with, or ping an old friend back to the room, meow.",
    "Agree on your symbol deck, lock in your choices in secret, and wait for the curtain call before comparing minds! Keeping that rhythm gives every duo a clean trail to look back on.",
    "Play together a few more times if you're having fun! Your constellation map will fill with bright stars, and Neko will point out which pairing shares thoughts most effortlessly.",
  ], [
    '你的默契搭档故事还需要再多添几笔共同记录，Neko 才能看出谁才是和你最来电的灵魂拍档呀！快去抓一个想一起玩的人，或者再把老搭档约回来喵～',
    '先商量好符号，然后各自独立作答，等最后一刻揭晓时再去对暗号。把这个小默契重复几次，每一种搭档组合就都有了扎实的前后对比样本啦。',
    '要是玩得正嗨，就不妨连着多测几局！你们的关系地图会越画越绚烂，Neko 也能明确告诉你，在所有势均力敌的组合里，哪一对最常心有灵犀喵！',
  ]),
  tied: copy([
    "The partners listed above are locked in a dead heat for your highest agreement rate! Neko has quite a few bookmarks to plant here—every single one of these bonds is glowing equally bright, meow~",
    "Sneak off with each partner separately while keeping the symbols and rules identical. Choose independently and chat only after the reveal, giving each bond its own pure chapter.",
    "Give each connection a couple more runs whenever you feel like it. We'll watch how each dynamic blooms without rushing to crown a single winner. There's plenty of room for multiple soulmates!",
  ], [
    '上面这几位搭档目前并列最有默契第一名，你们选到一块儿的几率一模一样高！Neko 这次要把手里的小书签全部分发出去了，每一条羁绊连线都超级耀眼喵～',
    '下次可以分别约他们再战几轮，但记得用相同的符号与规则哦。各自独立作答，揭开底牌后再热聊，这样每段缘分都能写下自己清晰的档案。',
    '有空就给每条连线再多添几场，完全不用急着逼出谁是独一份的第一名。Neko 可期待看到跟不同性格的朋友在一起时，彼此的默契会怎样各自盛放喵！',
  ]),
  only: copy([
    "The partner listed above shares your highest agreement rate by far! They're also the only one with enough comparable rounds under their belt. Neko would definitely book another session with them, meow~",
    "Stick with your trusted symbols and keep your minds private until reveal time. Once the cards flip, unpack why you picked what you picked! That gives this connection another solid brick to build on.",
    "Feel free to invite new faces whenever curiosity bites, too! More shared journeys will let your map compare different chemistry styles while keeping this warm connection close.",
  ], [
    '上面这位搭档目前和你最有默契啦！而且也是唯一累积了足够有效局数的知己。Neko 已经在心里悄悄给你们画了朵小花，下次绝对要接着玩喵～',
    '继续用熟悉的符号，选的时候互不偷看。等答案一并排开，再兴奋地交换想法，这样就能为你们俩专属的默契小路再铺上一块扎扎实实的砖。',
    '如果想认识新的火花，随时拉新朋友入局也没问题。共同记录越多，关系图就能横向比较不同搭档的化学反应，而眼前这份深厚的默契也会一直稳稳在场喵！',
  ]),
  single: copy([
    "The partner above takes the crown for your highest agreement rate among comparable pairs! Neko is leaving a special bookmark on this glowing thread—you two should definitely play again, meow~",
    "Use your familiar symbols, lock in your gut picks on your own, and save the stories for the reveal. Saving the whole session helps us track how your subtle synergy deepens over time.",
    "Don't forget to revisit your other friends whenever the mood strikes, either! Every partnership dances at its own tempo, and your partner map will keep every single memory safe.",
  ], [
    '在目前所有达到有效局数的搭档中，上面这位跟你最合拍啦！Neko 忍不住在这条发光的连线上夹了枚专属书签，下回一定还要拉上他/她再来玩喵～',
    '沿用相同的符号，各自凭第一直觉选定，揭晓后再围在一起拆解思路。把整场记录完整保留下来，我们就能继续观察这份默契是怎样随着时间悄悄生长的。',
    '想念其他朋友时，也可以随时约他们重温。每一段搭档关系都有属于它自己的节拍，关系图会把每一次相遇的电波都好好收藏在一起喵！',
  ]),
}

const synthesis = {
  mixed: copy([
    "Your different paths are moving to beats of their own: some are climbing, while others are taking a little nap. Neko will read each line separately so their distinct colors don't bleed together, meow.",
    "Keep settings steady in each game when you drop by. That lets us track both kinds of shifts clearly without mushing everything into a generic score and losing the fun details.",
    "Just chase whichever trail tickles your curiosity most for your next round! Wander to the other rooms whenever you feel like it; our next report will have deeper stories to compare across the board.",
  ], [
    '你的几个方向正在踩着各自不同的节拍跳舞呢：有的正在昂首向上，有的近期悄悄歇脚。Neko 会把它们分开来细看喵～',
    '下次在每种玩法里都尽量保留习惯的设置，这样我们就能持续追踪各自的变化啦。各个方向分开对比，细节最生动，完全没必要硬挤成一个笼统的总分。',
    '下一场就由着性子，挑那条你当下最好奇的线玩起来！其他方向有闲心了再去补，等你带着新战报回来，每个角落都会多出很多耐人寻味的对比喵！',
  ]),
  rising: copy([
    "Several paths are sprinting upward at the same time! Neko has multiple sparkling bookmarks to pin down on this report. Keep these triumphant runs close so we can track their momentum next time, meow~",
    "Stick with your winning settings if you want to see how this growth spurts forward. Don't stress over beating your personal best every single round—just save every result as it is!",
    "Our next report will show whether these lines keep soaring towards the sky or curve into a gentle glide. Pick your favorite game, play a full run, and bring your findings back whenever you're ready!",
  ], [
    '太棒啦！这次有好几个方向都不约而同地在往上窜，Neko 手里发光的书签都快不够用啦！先把这些扬眉吐气的记录收拾好，下次我们要分别盯着它们的势头喵～',
    '如果想看看这股冲劲能带你走多远，就用熟悉的设置继续玩。但不用把压力拉满、非要每一场都创新高，原汁原味地记下来，前后对比才最有故事感。',
    '下一份报告就会揭开谜底：这些线条是会继续直冲云霄，还是顺势滑翔成平稳的曲线？挑一个你最手痒的玩法完整战上一局，Neko 随时等你凯旋喵！',
  ]),
  stable: copy([
    "Several of your paths have been humming along at a super calm, steady level. Neko will keep this smooth stretch as a reliable compass for future visits, even if the curves aren't doing wild loop-de-loops, meow.",
    "You can keep rolling with your current style, or pick just one path and tweak a single knob. Keeping everything else familiar ensures you'll know exactly what caused what when we compare.",
    "Let your diary mirror the games you actually want to play. Future breakthroughs will look so much crisper with this peaceful stretch standing right beside them to show where the shift began!",
  ], [
    '你的好几个方向最近都在一条非常平和温婉的轨道上滑行。就算折线图没有画出惊心动魄的大波浪，Neko 也会把这段平稳的轨迹妥善保管，当成未来最值得信赖的罗盘喵～',
    '你可以继续沿着这套最顺手的方式玩，也可以挑其中一个方向、只微调一个小旋钮试水。其余保留原样，回头复盘时，因果关系就会清清楚楚。',
    '让记录跟着你真实想玩的心情走，不用为了图表好看去故意制造波动。未来某一天当全新的跃升出现时，我们一眼就能看出它是从哪里换挡加速的喵！',
  ]),
  single: copy([
    "One path showed a dramatic change, while the others are resting peacefully or waiting for more visits. Neko will follow that bold line first while keeping the other pages wide open, meow.",
    "Bring familiar settings back to that shifting path to see where the story goes next. Add rounds to the other games whenever you like, giving our next big comparison richer context.",
    "Every finished run hands us something juicy to read. Grab the game calling your name right now, finish the whole set, and we'll slip its fresh results right alongside the old ones!",
  ], [
    '这一次有一个方向杀出重围、有了特别鲜明的起伏，而其他几条线要么波澜不惊，要么还在等新数据。Neko 决定先顺着这只领头羊的方向看，其他页面也给你留好空位喵～',
    '下一局先在这个起伏明显的方向沿用老设置，看看这场变奏会怎样演变下去。其他玩法就按你的随心节奏去慢慢补，这样下次横向对比时背景就更充实了。',
    '只要完整测完一局，我们手里就会多出一份货真价实的情报。挑那个正撩拨着你好奇心的项目去玩吧，等新成绩出炉，我们立刻把它贴在旧记录身旁喵！',
  ]),
  pending: copy([
    "Your map has sketched out its first lovely outlines, but tracking shifts over time still needs a few more visits. Neko will keep these open rooms ready and waiting—start with whatever game you miss most, meow!",
    "Try another round with familiar settings, or check back in with the daily questionnaire. Keep every full record—even the quiet, sleepy ones—so our timeline doesn't drop a single beat.",
    "No need to paint every corner in a single day! Each fresh round gives us a sweet new puzzle to talk about, and you can casually decide where to head next once you see how it felt.",
  ], [
    '你的探索画像已经勾勒出了非常可爱的初貌，不过要想画出连续变化的折线，还在眼巴巴等更多的回访呢。Neko 先把空白处擦得干干净净，你挑个最想玩的先开始就好喵～',
    '可以用熟悉的设置再开一场，或者回到问卷去给最近的心灵状态打个卡。每一次完整的记录都要好好存着，哪怕是平平无奇的对局，也是时间线上宝贵的节点。',
    '不用逼自己一口气把四个方向填满，每一次新造访都会给我们带来新的谈资。等看完这次的表现，你再慢悠悠地决定下一步想去哪儿冒险喵！',
  ]),
}

const notes = {
  welcome: copy([
    "Hi there! I'm Neko. Pick a game and I'll curl up right beside you through hidden targets, future glimpses, paired telepathy, and everyday soul ripples. Let's explore them one cozy step at a time, meow~",
  ], [
    '你好呀，我是 Neko！隐藏感知、未来预知、双人默契还有日常心境，四个奇妙方向都可以一起玩。先挑你最心动的那一个，Neko 陪你慢慢探索喵～',
  ]),
  report_intro: copy([
    "Neko has gathered all your finished journeys in one place! We'll peek at your favorite games, lines that shifted, and the companions who locked minds with you. Start with whichever page calls to your paws first, meow!",
  ], [
    'Neko 把你所有用心完成的足迹都整理好啦！我们会一起看看你常去的角落、最近悄悄起伏的曲线，还有那些和你心意相通的搭档。挑你最顺眼的那一页，翻开看看吧喵！',
  ]),
  recent_pending: copy([
    "Our timeline needs a couple more visits before it can compare earlier and later chapters. Stick with your cozy settings for another full run, and Neko will weave it straight into your tapestry, meow~",
  ], [
    '时间线还需要再多攒一两张新记录，才能清晰对比出前后两段的起伏。下一把保留熟悉的设置完整做完，Neko 会立马把它接进图表里等你来翻喵！',
  ]),
  radar_guide: copy([
    "The radar chart gathers all four paths onto a single canvas. Admire each one on its own terms; blank spots can just snooze until you're ready to explore them. Neko will ink in their dots the moment a full run arrives, meow!",
  ], [
    '雷达图把四个探索维度同时摆在了一张画纸上，各自独立欣赏就好。还没涉足的方向先留白，等你什么时候完整玩过了一趟，Neko 第一时间替你画上新坐标喵！',
  ]),
  radar_note: copy([
    "The mini-games show off your hit and match rates here, while DSES maps your reported life vibes onto the same canvas scale. Peek at the individual notes to see how each point earned its spot, meow.",
  ], [
    '实验玩法在这儿展示的是命中率或默契一致率，而问卷则把你日常的心境体验换算到了同一个可视尺度上。点开各页的细则，就知道每个点点是怎么落下的啦喵。',
  ]),
  network_intro: copy([
    "Every thread ties you to someone you've shared a game with. Neko keeps each duo's memories together; a thicker thread simply means you've piled up more valid shared rounds between you, meow~",
  ], [
    '每一根发光的细线，都连着一位曾和你并肩作答的同伴。Neko 把你们的共同战绩好好收在一起，线条越粗，说明你们一起经历过的有效回合越多、羁绊越深喵～',
  ]),
  network_empty: copy([
    "Your partner constellation is still waiting for its very first star! Invite someone to choose secretly alongside you, wait for the reveal, and Neko will enthusiastically draw your first shimmering link, meow~",
  ], [
    '搭档星图还在静悄悄等待第一根连线诞生呢！挑个好友一起隔空独立选择，等大揭晓的那一刻完成，Neko 就会欢天喜地地为你们连上第一条羁绊线喵！',
  ]),
  network_caption: copy([
    "This map gathers companions from your own completed sessions. Signed-in partners keep their shared history across visits, while guest links stay tied to their specific rooms so different folks don't get tangled up, meow.",
  ], [
    '这张星图只记录和你真正并肩作战过的同伴。登录过账号的搭档，历史记录会一直延续；游客则按房间号各自留档，这样就不会把不同的小伙伴弄混啦喵。',
  ]),
  network_empty_caption: copy([
    "Your very first paired adventure will hand this map its anchor point. Grab some familiar symbols, pick in secret, and wait for the reveal before debating your theories. Neko will take care of the memories, meow!",
  ], [
    '只要完成你们的第一场双人测试，地图上就会落下第一个美丽的锚点。选好熟悉的符号，各自定夺、等待揭晓，做完后再好好复盘，Neko 会替你们守好这份回忆喵！',
  ]),
  trend_other: copy([
    "These runs used a different set of knobs and dials, so Neko tucked their line onto a separate shelf. Browse them here, and drop back in with the same setup whenever you feel like comparing notes later, meow.",
  ], [
    '这一组测试换用了不同的设置参数，所以 Neko 贴心地给它单独留了一张走势图，不跟其他混在一起。之后想对比，就用同样的设置再打几局完整对决吧喵！',
  ]),
  trend_empty: copy([
    "Your timeline is waiting for its very first completed story! Dive into a game or fill out the questionnaire, then come curl up here. Neko will ink that first point as our brave starting line, meow~",
  ], [
    '时间线上还在静候第一枚脚印落位呢！去痛快玩一场或者认真填份问卷，然后再回来看看。Neko 会把第一张成绩单端端正正摆上图，作为一切故事的起点喵～',
  ]),
  method_profile: copy([
    "Neko waits for 20 valid rounds before unlocking a deep profile breakdown. The six archetypes simply describe where your time and curiosity were spent across games and questionnaires, meow.",
    "Solo games measure their match rate against a 20% baseline. Swings greater than 5 percentage points above or below earn their own lively titles, while the cozy middle band is celebrated as steady exploration.",
  ], [
    '当实验累计满20个有效回合后，Neko 才会给出更细腻的画像解读。六种探索画像反映了你在实验游戏与心境问卷之间的时间分配，用来描绘你的专属重心喵。',
    '单人玩法均以 20% 的理论概率作为参考基准。命中率浮动超过上下各 5 个百分点时，会切换到对应的状态解读；处于中间区间的，则被温柔地记录为平稳探索喵。',
  ]),
  method_trend: copy([
    "Spotting a trend requires at least 3 runs using the exact same protocol and symbols. Each comparison window takes min(3, floor(n/2)) entries from your oldest and newest sessions, keeping them completely uncrossed, meow.",
    "Each experimental window needs at least 10 rounds, weighted by round count. A difference over +5% counts as rising, below -5% as dipping, and anything in between as steady cruising.",
  ], [
    '计算趋势至少需要 3 份相同流程、相同符号的记录。前后对比区间各取 min(3, floor(n/2)) 份样本，且两段绝不重叠交叉，这样 Neko 才能客观比较前后表现喵。',
    '实验类趋势的前后区间各需至少 10 个回合，并按回合数加权计算比例。前后差值超过 ±5 个百分点分别记为上升或回落，其余则被归为稳健的平稳期喵。',
  ]),
  method_partner: copy([
    "Partner rankings only count signed-in pals with at least 10 rounds under the active comparison group. Neko ranks their agreement rates under matching settings and lets tied leaders purr side by side without forcing a crown, meow!",
  ], [
    '搭档默契排行榜只统计登录用户、且在当前对比组下满 10 个回合的同伴。Neko 会比对相同设置下的一致率，遇到分数打平时就并列展出，才不急着分出高下呢喵！',
  ]),
  method_dses: copy([
    "DSES descriptions require fully answered questionnaires. A mean of 4 or higher is frequent, 2.5 up to 4 is occasional, and anything under 2.5 marks a quieter, grounded chapter, meow.",
    "Neko maps the DSES mean onto the radar as (mean - 1) / 5 * 100. Old and new entries carry equal weight; a shift beyond 5 visual points is what nudges the trend arrow up or down.",
  ], [
    'DSES 日常灵性体验的解读严格要求完整答卷。均值达到 4 分为体验频繁，2.5 到 4 分之间为间歇出现，低于 2.5 分则属于相对安静质朴的生活阶段喵。',
    '雷达图上的展示值按 (均值 - 1) / 5 * 100 折算映射。前后问卷取等权重平均，当折算后的显示差值超过 ±5 点时，趋势才会判定为上升或回落，否则一律视为平稳喵。',
  ]),
  reading_note: copy([
    "Neko reads these records purely as a personal exploration adventure! These descriptions are not certifications of psychic superpowers, and the Chinese DSES is an informal translation not validated as a clinical scale. Please explore with a light heart and an open mind, meow~",
  ], [
    'Neko 陪你翻阅的只是充满趣味的探索记录，这份报告绝不代表任何超自然特异功能认证哦！中文 DSES 也是网页参考翻译，并未经过严格的量表效度验证，请抱持轻松好奇的心态阅读喵～',
  ]),
  dimension_missing: copy([
    "This path is still pristine and untouched! Whenever curiosity strikes, treat it as a secret doorway and follow the prompts. Neko will ink in your radar and insights the second you emerge, meow~",
    "Your very first run will gift all future visits an anchor. You can keep the settings familiar next time, then place the fresh attempt right beside your pioneering steps.",
  ], [
    '这一片小天地目前还是纯洁的空白呢，想尝鲜的时候，随时把它当成一扇新任意门吧！跟着页面指引走一遍，Neko 就会火速为你画出对应的图表和暖心解读喵～',
    '第一场对局会给今后的所有探索提供宝贵的锚点。下次可以换上习惯的设置再来一次，把新战报摆在最初的起点身旁，静静观察奇妙的改变喵。',
  ]),
  dimension_limited: copy([
    "You've left a few sweet paw prints along this path! Neko has our anchor down; a couple more complete runs with familiar settings will give us so much more to unravel together, meow.",
    "Notice how your decisions feel, from snap flashes to quiet pauses. Save the whole batch, and wander back when you feel the itch. Fresh runs will paint this canvas with lovely detail!",
  ], [
    '这个方向已经印下了第一串可爱的小爪印，Neko 稳稳抓到你的出发点啦！保留熟悉的设置，再耐心试上几局，我们就能解锁更多耐人寻味的对话喵～',
    '无论是电光石火间下定决心，还是屏息思索良久的回合，都值得被完整留存。想玩时随时折返，新的记录会像画笔一样，把这一页点缀得越来越饱满生动喵！',
  ]),
  trend_insufficient: copy([
    "This timeline needs a few more visits before Neko can compare its past and present chapters. Stick to your favorite settings, play through to the end, and let the session become our next neat entry, meow.",
    "For now, just tune into the natural rhythm of your sessions without hunting for a climb or a drop. Interlocking runs will give us a crystal-clear view once you bring another story home!",
  ], [
    '这条时间线还需要再多积累几次造访，Neko 才能把前言和后记放在一起比对。先用你最顺手的配置把一整场踏踏实实做完，为时间轴接上崭新的一环喵。',
    '眼下大可只关注每一次答题的心流节奏，不用急着寻找上升或跌落的痕迹。等几个点串成了线，再次回来翻阅时，前后脉络就会格外清晰好读喵！',
  ]),
  guidance_explore: copy([
    "Treat an uncharted path to a cozy trial run whenever you're curious! Pick whatever sounds most fun, see it through, and decide whether you want to return later. Neko will happily guard the fort, meow~",
  ], [
    '挑个还没踏足过的全新方向放手试一试吧！挑那个听上去最好玩的玩法，完整体验一次，再决定要不要常常回来。剩下的那些，Neko 陪你慢慢探索不着急喵～',
  ]),
  guidance_dses: copy([
    "Give everyday life its very own page in the book! Fill out the DSES keeping your general recent days in mind. When you drop by next time, Neko will place your newest reflections right beside this first memory, meow.",
  ], [
    '也给日常生活里的微光留下一页印记吧！完整填一份 DSES 问卷，照着最近这段日子的综合感受如实作答就好。等下一次回来，Neko 就能帮你把生活的心境接连起来喵。',
  ]),
  guidance_partner: copy([
    "Set up another date with a partner you love playing with! Stick to trusted symbols, choose in secret, and wait for the curtain call to swap theories. Swapping seats can reveal a whole new angle on your chemistry, meow~",
  ], [
    '挑一位合拍的搭档再续一局双人默契吧！用熟悉的符号，各自独立感应作答，揭晓后才互相坦白底牌。你们还可以对调角色，看看换个角度时又会撞出怎样的新火花喵！',
  ]),
  guidance_rhythm: copy([
    "Settle on your symbols and round count before diving in, then play through to the finish line before reviewing. Neko will keep the entire journey safe—even the runs you felt grumbly about, meow!",
    "If you want to experiment with a new approach, nudge just one tiny habit at a time. Keeping the rest of the stage familiar will make reading before-and-after chapters an absolute breeze!",
  ], [
    '下一局开战前先定好习惯的符号与局数，一口气玩到终点再整体复盘。哪怕是不太满意的一局也要留存好，Neko 会珍视你的每一次勇敢尝试喵！',
    '如果想换个新思路感应，一次只调整一件微小的事情就好，让其他规则继续熟悉。这样以后再翻回这份报告，前后的变化才会一目了然、清晰可辨喵！',
  ]),
}

export const NEKO_COPY_KEYS = Object.freeze(Object.keys(notes))
export const nekoCopy = (key, en = false) => read(notes[key], en)
export const profileCopy = (key, en = false) => read(profiles[key], en)
export function dimensionNarrative(key, tier, en = false) {
  const [zhTitle, enTitle, body] = dimensions[key][tier]
  return { verdict: en ? enTitle : zhTitle, text: read(body, en) }
}
export function trendNarrative(d, direction, en = false) {
  const entry = d.key === 'dses' ? dailyTrends[direction] : experimentTrends[direction]
  let text = read(entry, en)
  if (d.key === 'telepathy') text = en ? text.replace(/matches/g, 'shared choices') : text.replaceAll('和答案对上', '两人选到一起').replaceAll('没选中的答案', '不同的选择')
  return text
}
export function partnerNarrative(_names, leaderCount, candidateCount, en = false) {
  // Names are rendered separately from paragraphs so long account names never
  // change paragraph length. The named leaders remain in analysis.partner.leaders.
  const key = !leaderCount ? 'empty' : leaderCount > 1 ? 'tied' : candidateCount === 1 ? 'only' : 'single'
  return read(partners[key], en)
}
export function synthesisNarrative(trends, en = false) {
  const up = trends.filter(t => t.direction === 'up'), down = trends.filter(t => t.direction === 'down'), stable = trends.filter(t => t.direction === 'stable')
  const key = up.length && down.length ? 'mixed' : up.length >= 2 ? 'rising' : stable.length >= 2 && !up.length && !down.length ? 'stable' : up.length || down.length ? 'single' : 'pending'
  // A changing direction gets its own paragraph instead of a long label list.
  const changes = [...up, ...down].map(t => en
    ? `${t.label} is ${t.direction === 'up' ? 'rising' : 'lower'} recently. Neko will follow this direction separately using comparable sessions, then read the next visit beside the earlier ones.`
    : `${t.label}近期${t.direction === 'up' ? '正在上升' : '有所回落'}，Neko会单独沿着这一方向继续看。下一场保留熟悉设置，再把新的记录放在前面几场旁边。`)
  return [read(synthesis[key], en), ...changes].join('\n\n')
}
