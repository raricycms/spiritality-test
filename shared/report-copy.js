// English was rewritten first with humanize-ai-writing, then translated into
// short Chinese paragraphs. Each pair keeps the English draft beside its translation.
const copy = (en, zh) => ({ en, zh })
const read = (entry, en = false) => entry[en ? 'en' : 'zh'].join('\n\n')

const profiles = {
  multi: copy([
    "You've tried all four directions. Neko can now read your solo choices, paired sessions and everyday experiences side by side. There's plenty to come back to.",
    "Pick the task you most want to play again. Keep its settings for a few visits, then check another direction when you feel curious. You don't need to finish everything in one day.",
    "The comparisons are getting interesting: which lines stay steady, and which change? Bring the next session back here and we'll see how it fits with the earlier ones.",
  ], [
    '四个方向你都已经试过啦，Neko可以把独自选择、双人默契和日常体验放在一起读。这次有不少地方值得回头看看。',
    '下次先挑一个最想再玩的项目，保留熟悉的设置试几场。想换口味时再去别的方向逛逛，不用一天把所有项目做完。',
    '现在可以慢慢比较，哪些线比较平稳，哪些正在变化。等你带着下一场记录回来，我们再看看它和之前有什么不同。',
  ]),
  early: copy([
    "You're on the first few pages. Neko has a handful of observations to read, and several games are still waiting for you. Start with whichever one sounds fun.",
    "Notice how you choose, too. Does an answer arrive quickly, or do you look again before deciding? You can keep that small detail for yourself after the session.",
    "Come back when you feel like another round. A few familiar sessions will give us more to talk about and help you find the direction you want to keep exploring.",
  ], [
    '你的探索才翻开前几页，Neko已经收到一些小片段，还有几种玩法等着你。先挑最感兴趣的那个，轻轻松松玩起来。',
    '也可以留意自己怎样选择：答案一下就冒出来，还是看几遍才决定？测完以后，把这个小细节留给自己回味就好。',
    '想玩的时候再回来试几场，熟悉的记录多一些，我们就有更多话可聊。你也会更容易找到自己想继续探索的方向。',
  ]),
  pair: copy([
    "Paired sessions take up more of your record. You seem to enjoy putting two separate choices together and checking where they meet. Neko has a partner map to read here.",
    "Invite a familiar partner back with the same symbols. Choose independently, then talk after the reveal. Those repeat visits give each pairing something to compare.",
    "You can swap sender and receiver, too. Or invite someone new when you're curious. Keep the settings clear so you can read each partnership's sessions together later.",
  ], [
    '你的记录里，双人玩法占了更大的位置。两个人各自选好，再看答案会不会碰到一起，Neko也很想跟着看揭晓呢。',
    '下次可以约熟悉的搭档，用同一组符号再试几场。先各自独立选择，揭晓之后再聊天，这样就有前后能比较的记录啦。',
    '也可以交换发送者和接收者，或者邀请新朋友加入。记清楚每次的设置，以后翻回来，就能分别读读每种组合的故事。',
  ]),
  journal: copy([
    "Your record has more everyday experience in it. Neko can follow what you've reported across questionnaires, so this part of the report moves at the pace of ordinary life.",
    "Return to the questionnaire when the timing feels comfortable. Think about the recent period as a whole; a quiet day or an eventful day doesn't have to speak for every day.",
    "Keep your earlier entries beside the new ones. Later you'll be able to see which feelings became more frequent and which stayed much the same. There's no rush to fill the timeline.",
  ], [
    '你的记录更多来自日常体验，Neko会跟着问卷看看这些感受怎样变化。这一部分慢慢读就好，节奏可以跟着生活走。',
    '下次填问卷时，想想最近一段时间的整体感受。安静的一天或特别热闹的一天，都不用替所有日子回答，照实选就好。',
    '把旧问卷和新问卷留在一起，以后就能看看哪些感受更常出现，哪些大体相似。时间线慢慢补，不急着一下填满喵。',
  ]),
  focused: copy([
    "One game holds most of your observations. You've given it enough attention for Neko to follow its ups and downs across sessions. That's a clear place to return to.",
    "Keep the familiar symbols for another visit and notice how you make each choice. If you'd like a new approach, change one thing at a time so the sessions remain easy to compare.",
    "You can stay with this game or try a different one for a fresh angle. Choose what you actually want to play next; the report will keep both kinds of visits for you.",
  ], [
    '你在一种玩法里留下了明显更多的记录，探索有了自己的重心。Neko可以沿着这条线，陪你看看不同场次的起伏。',
    '下次保留熟悉的符号，再留意自己每轮怎样决定。想换一种做法也行，一次只改一件事，前后的记录会更容易比较。',
    '继续玩这一项，或去别的项目尝尝鲜，都由你来选。挑真正让你想再试一次的方向，Neko会帮你把记录好好留下。',
  ]),
  steady: copy([
    "Your visits are spread across several games. You haven't settled on one route, which gives Neko different kinds of sessions to read separately. Keep following what interests you.",
    "For the next few visits, choose one familiar set of settings. You can then compare sessions without having to untangle several changes at once. The other games can wait a little.",
    "When you return, we'll look at what changed and what stayed familiar. That can help you choose your next game without turning every session into a target to beat.",
  ], [
    '你正在几个玩法之间慢慢探索，还没有只沿着一条路线走。Neko会把不同方向分别读，看看每种玩法留下了什么。',
    '接下来可以先保留一组熟悉的设置，连着试几场。这样前后更容易比较，也不用一次弄清好多变化，其他项目稍后再玩。',
    '等你再回来，我们一起看看哪些地方变了，哪些还是熟悉的样子。下一场想玩什么，可以照着兴趣选，不用追着成绩跑。',
  ]),
}

const dimensions = {
  hidden: {
    above: ['感知亮点', 'Perception highlights', copy([
      "Your hidden-information choices matched more often than the reference line. Neko would put a bookmark here: this is one part of the record worth returning to.",
      "Next time, notice whether an option arrives at once or you move between several. Keep the same symbols and finish the session before looking back at how you chose.",
      "Bring a few more sessions to this page. We can then see whether those extra matches show up again or were concentrated in one visit. There's a specific question to follow now.",
    ], [
      '隐藏信息这一项，你和答案对上的时候比参考线更多。Neko先替你夹个小书签，这里值得下次回来再仔细看看。',
      '下次留意答案是一下冒出来，还是在几个选项间来回想。保留同一组符号，完整做完以后，再回看自己选择时的节奏。',
      '多带几场记录回来，我们就能看看这些亮点有没有再次出现，还是集中在某一场。现在有一个具体的小问题可以追啦。',
    ])],
    near: ['平稳探索', 'Steady exploration', copy([
      "Your matches are close to the reference line in hidden-information trials. This part of the record is fairly steady, so Neko would keep it as a starting point for the next visit.",
      "Try one familiar approach for a full session. Notice which choices feel quick and which need another look. You can revisit those differences after the answers are revealed.",
      "More sessions with the same settings will show whether this line stays near its current level or moves. A steady page is useful when you later want to compare a change.",
    ], [
      '隐藏信息的命中比例目前靠近参考线，这一段比较平稳。Neko会把它先留在这里，给下一次回访做个熟悉的起点。',
      '先用一种熟悉的做法完整玩一场，留意哪些选择很快，哪些要再看一眼。等答案揭晓以后，再慢慢回味这些小差别。',
      '同样设置下再多玩几场，就能看看这条线会保持现在的水平，还是有所变化。以后想比较时，这段平稳记录也用得上。',
    ])],
    below: ['换个节奏再试', 'Try a fresh pace', copy([
      "There are fewer matches in this hidden-information chapter. Neko would give the next session a simple starting point: familiar symbols and enough time to finish comfortably.",
      "If you'd like to try a different pace, change one thing. You could pause briefly before choosing while keeping the symbols and session length. Then review the complete record.",
      "Keep this visit beside the next one, including the choices that missed. Having both pages will let you see what actually changed when you try the game again.",
    ], [
      '这段隐藏信息记录里，和答案对上的时候少了一些。下次用熟悉的符号，找个不赶时间的时刻，轻松完成一场就好。',
      '想试试新节奏的话，可以选择前稍作停顿，其他设置先保留。一次改一件小事，做完以后再回看整场，会比较清楚。',
      '把这一场和下一场都留着，没选中的回合也一起留下。等你再玩回来，Neko就能陪你看看前后到底有哪些变化啦。',
    ])],
  },
  precognition: {
    above: ['预知亮点', 'Precognition highlights', copy([
      "You chose before the answers existed, and this chapter contains more matches to the later results. Neko has a bookmark for this line too. It's worth another visit.",
      "Notice how you reach a choice before submitting it. Keep a familiar approach for the whole session, then compare it with this one after all the results have appeared.",
      "Each finished session will give these matches more context. We'll be able to see whether they recur across visits or belong mainly to this chapter. Keep the question open for next time.",
    ], [
      '你先做出选择，再等答案生成，这一段和后来结果对上的时候更多。Neko也给这里夹个书签，下次可以继续回访。',
      '提交之前，可以留意那个决定是怎样出现的。整场先用熟悉的做法，等结果全部揭晓以后，再和今天这份记录一起看。',
      '每次完整做完，都能给这些亮点添一点前后文。我们就能看看它们会不会再次出现，还是主要留在这一段记录里面。',
    ])],
    near: ['平稳探索', 'Steady exploration', copy([
      "Your choices and later answers match at a fairly steady rate near the reference line. This game has a simple rhythm: choose first, then wait to see what appears.",
      "Keep that rhythm for another complete session. Let each choice stand once you've submitted it, and review after the reveal. Neko can read the whole visit with you afterward.",
      "A few more visits will connect these separate results. Then you can see whether the line stays steady or takes a new direction, with today's record still there to compare.",
    ], [
      '你的选择和后来答案对上的比例靠近参考线，目前比较平稳。这项玩法的节奏很简单：先选好，再等结果慢慢揭晓。',
      '下次也按这个顺序完整玩一场，提交以后就让选择留在那里。等揭晓后再回看，Neko会陪你读读整场留下的记录。',
      '再回来几次，分散的结果就能接成一条线。它会继续平稳还是换个方向，到时可以把新记录和今天这一页放在一起看。',
    ])],
    below: ['重新寻找节奏', 'Find your pace again', copy([
      "Your choices matched the later answers less often in this chapter. For the next visit, Neko would set one easy aim: finish a whole session at a pace that feels comfortable.",
      "Use the same symbols and keep your approach consistent. If a different time of day suits you better, try that while leaving the other settings alone. Review after you've finished.",
      "Keep both visits in the report. That gives you something concrete to compare the next time you return, including the rounds that didn't go the way you hoped.",
    ], [
      '这一段里，你的选择与后来答案对上的时候偏少。下一场先给自己一个简单目标，用舒服的节奏把整场完整做完喵。',
      '符号和做法先保持熟悉，想换到更方便专心的时段也可以。其他设置暂时保留，做完再一起看结果，比较起来更清楚。',
      '前后两场都留在报告里，没有选中的回合也留着。这样下次回来，就有具体的记录可以比较，看看哪些地方发生变化。',
    ])],
  },
  telepathy: {
    above: ['默契逐渐显现', 'Shared choices stand out', copy([
      "Matching choices take up at least half of your paired record. Neko can point to rounds where you met at the same answer. This pairing is worth revisiting.",
      "Invite the same partner back with familiar symbols. Let the sender settle on a choice and the receiver choose independently, then talk after the reveal about what came to mind.",
      "You can swap roles for another session, too. Keep those shared visits together and we'll see whether matching choices keep appearing across the two ways of playing.",
    ], [
      '你的双人记录里，相同选择已经占到至少一半，留下不少碰到同一个答案的回合。Neko想继续看看这份默契呢。',
      '下次约同一位搭档，用熟悉的符号再玩。发送者先定好，接收者独立选择，等揭晓之后，再聊聊当时想到了什么。',
      '也可以交换角色再完成一场，把共同记录留在一起。我们就能看看换个方向玩时，相遇的选择会不会继续出现在里面。',
    ])],
    below: ['默契仍在展开', 'Agreement is taking shape', copy([
      "Different choices take up more of your paired record so far. Neko would keep this as the first part of your shared story and give the same pairing another visit.",
      "Keep the symbols familiar. The sender chooses first, and the receiver decides independently. After the reveal, you can talk about what drew each of you to your option.",
      "A few more sessions will give the connection more detail. Swapping roles can add another view, while repeating the settings lets you compare how this pairing develops.",
    ], [
      '你和搭档目前更多时候选了不同答案，相遇的选择还没有占到多数。Neko先留好这一页，下次可以接着写双人故事。',
      '保留熟悉的符号，发送者先选择，接收者再独立判断。等答案揭晓之后，你们可以聊聊为什么会想到各自那个选项。',
      '共同记录多留几场，这条连线就会有更多细节。交换角色也可以添一个视角，相同设置方便你们回头比较前后的变化。',
    ])],
  },
  dses: {
    above: ['日常体验丰富', 'Frequent everyday experience', copy([
      "Your questionnaire reports these daily experiences quite often. Neko reads this page as a part of your everyday life, and you can give those answers your own familiar meaning.",
      "When you return, think about the recent period as a whole. You might recall moments that felt meaningful or connected, without needing to find something special every day.",
      "Keep living at your usual pace and fill in the questionnaire again when you want to. Several visits will let you see whether these experiences stay frequent or change over time.",
    ], [
      '问卷里，你报告的这些日常体验比较频繁。Neko会把这一页放进生活的部分，用你熟悉的理解，慢慢读这些回答。',
      '下次可以回想最近一段时间，哪些片刻让你觉得有意义，或和周围有所连接。照着整体感受选，不用每天寻找特别经历。',
      '按平常的节奏生活，想记录时再回来填一份。几次问卷放在一起，就能看看这些体验一直很频繁，还是慢慢有了变化。',
    ])],
    near: ['体验间歇出现', 'Experience comes in moments', copy([
      "These experiences appear in your answers from time to time. Neko would let this page grow at an ordinary pace; there's no need to search for one striking moment to explain it.",
      "At the next visit, consider the recent period as a whole. Use your own understanding of the questions and choose what fits. A brief quiet patch can stay in the record too.",
      "Several questionnaires will give those separate moments a timeline. You can then look back at which experiences became more frequent and which kept a similar pace.",
    ], [
      '这些体验在你的回答里时不时出现，日常中有一些这样的片刻。Neko觉得可以慢慢记录，不用急着找最特别的一次。',
      '下次想想最近一段时间的整体感受，按自己的理解选合适的回答。偶尔安静一点也照实留下，记录可以跟着日子走。',
      '几份问卷放在一起，零散的感受就有了时间顺序。以后回看，可以慢慢分辨哪些体验更常出现，哪些还是相近的节奏。',
    ])],
    below: ['安静的体验阶段', 'A quieter chapter', copy([
      "You report these experiences less often in the questionnaire. Neko would keep this quiet page as your starting point and leave room for whatever you report on a later visit.",
      "Use the meanings that feel familiar to you. You don't have to search for something unusual to fit an option. Think about the recent period, then choose the answer that fits.",
      "Come back at a comfortable pace. Keeping this questionnaire beside the next one will let you see whether this quieter chapter changes or stays much the same.",
    ], [
      '问卷里，你报告的这类体验出现得较少，这一页比较安静。Neko先把它留作起点，等你下次回来，再一起看看变化。',
      '用自己熟悉的意思理解问题就好，不用替选项寻找特殊含义。想想最近一段时间的整体感受，选贴近自己的那个回答。',
      '以后按舒服的节奏回来填写，把今天和下一份问卷放在一起。到时就能看看这段安静的记录有了变化，还是大体相似。',
    ])],
  },
}

const dailyTrends = {
  up: copy([
    "Your daily spiritual experience is more frequent recently. Neko can see the newer questionnaires sitting above the earlier ones. This part of your record has an upward turn.",
    "Keep answering with the recent period in mind. Notice moments you want to remember, and let ordinary days stay ordinary. You don't have to find a special feeling every day.",
    "Return when you feel ready for another entry. The next questionnaire will let us see how this change continues, with the earlier answers still beside it for comparison.",
  ], [
    '你的日常灵性体验近期更频繁了，最近的问卷比早一些的记录更高。Neko看到这条生活线往上走，想陪你接着看看。',
    '继续按最近一段时间的整体感受填写，遇到想记住的片刻可以留意一下。普通日子照常过，不用每天都找特别的感受。',
    '想记录时再回来填一份，我们就能看看这段变化接下来怎样延续。旧回答也会好好留着，方便你把前后的体验一起读。',
  ]),
  stable: copy([
    "Your daily spiritual experience has stayed at a similar level recently. Neko reads this as a steady stretch of your timeline, with no large change between the two periods.",
    "Keep thinking about the recent period in the same way. Familiar feelings can stay on the page without needing a dramatic event to make the record worth keeping.",
    "When you return, put the new answers beside these ones. You can see what still feels familiar and what changed, using this steady stretch as a reference.",
  ], [
    '你的日常灵性体验近期保持在相近水平，前后问卷没有明显转折。Neko会留好这一段平稳的生活线，等你下次回来。',
    '继续用熟悉的方式回想最近一段时间就好，平常的感受也可以照实留下。日子不需要发生大事，记录一样有东西可读。',
    '以后把新回答放在这几份问卷旁边，就能看看哪些感受还是熟悉的，哪些悄悄变了。这段平稳记录会是方便的参照。',
  ]),
  down: copy([
    "Your daily spiritual experience is less frequent recently. The newer questionnaires form a quieter stretch than the earlier ones. Neko would keep both parts of the timeline.",
    "At the next visit, consider the recent period as a whole again. You can let this change stay on the page without finding an immediate explanation for it.",
    "Later answers will show whether the line rises again or keeps this pace. Keep each entry so the next report can read the whole sequence with you.",
  ], [
    '你的日常灵性体验近期比之前少了一些，新的问卷留下了更安静的一段。Neko会把前后都留好，让生活线完整一些。',
    '下次填写时，依然回想最近一段时间的整体感受。先让这个变化留在纸上，不急着替它找原因，按自己的真实感受选。',
    '后面的回答会告诉我们，这条线会再次往上，还是维持现在的节奏。每份都留着，下次就能一起读读完整的变化啦。',
  ]),
}

const experimentTrends = {
  up: copy([
    "This direction is rising recently. With the same settings, later sessions contain more matches than the earlier ones. Neko would keep this turn marked for your next visit.",
    "Keep the symbols and process familiar for another session. Finish it before reviewing the result, then put the complete record beside these earlier visits.",
    "You can follow the change with curiosity. Each session can have its own result; the next few visits will show whether this upward stretch continues or changes pace.",
  ], [
    '这一方向近期正在上升，同样设置下，最近和答案对上的时候更多了。Neko先标记好这个转折，等你下次回来继续看。',
    '下一场保留熟悉的符号与流程，完整做完以后再回看结果。把整场记录放在之前的几场旁边，前后的变化会更容易读。',
    '带着好奇接着玩就好，每一场都可以有自己的结果。再回来几次，我们会看见这段上升继续延伸，还是慢慢换了节奏。',
  ]),
  stable: copy([
    "This direction has stayed near the same level recently. Neko can keep this steady stretch as a reference when you return with another session using familiar settings.",
    "Repeat the current approach if you're comfortable with it. If you want to try something different, change one small thing and leave the other settings as they are.",
    "Keep the full session each time. Then a later change will have earlier visits to sit beside, and we can read where the line moved and where it stayed familiar.",
  ], [
    '这一方向近期没有明显上升或回落，记录大体停在相近的水平。Neko会把这段平稳的线留下，给下次回访做个参照。',
    '用现在的做法再玩几场也行，想试一点变化也可以。一次调整一件小事，其他设置先保留，这样比较时会更清楚些。',
    '每次都留完整记录，以后有了变化，就能放在这几场旁边看。我们可以慢慢读出哪里动了，哪里还是熟悉的样子。',
  ]),
  down: copy([
    "This direction is lower recently, with fewer matches in the newer sessions. Neko would keep this part of the curve and give the next visit a comfortable starting point.",
    "Use familiar settings and finish the whole session. You can notice your pace as you choose, then review afterward without needing to explain every missed answer.",
    "A few more sessions will add context to this dip. We'll see whether the curve comes back up, holds steady, or changes again, with this chapter still in the report.",
  ], [
    '这一方向近期有所回落，新的几场和答案对上的时候少了些。Neko会留好这段曲线，下一场从舒服的节奏重新开始。',
    '用熟悉的设置完整做完一场，顺便留意自己选择时的节奏。等结束再回看就好，不用替每个没选中的答案马上找解释。',
    '再多几场记录，这段回落就有了前后文。我们会看见曲线重新向上、保持平稳，或有别的变化，今天这一页也会留着。',
  ]),
}

const partners = {
  empty: copy([
    "Your partner story needs a few more shared sessions before Neko can pick out a leading pairing. Invite someone you'd like to play with, or revisit an existing partner.",
    "Agree on the symbols, then make your choices independently. Wait until the reveal to talk about them. Repeating that process gives each pairing visits we can compare.",
    "Come back together a few times if you enjoy it. The map will then have more to show, and Neko can point out which comparable pairing shares choices most often.",
  ], [
    '你的搭档故事还需要多几场共同记录，Neko才能找到目前最有默契的组合。可以邀请想一起玩的人，也可以再约老搭档。',
    '先约好符号，再各自独立选择，等答案揭晓后才聊想法。把这个流程重复几次，每种组合就有前后可以比较的记录啦。',
    '如果玩得开心，就一起再来几场。关系图会添上更多内容，Neko也能告诉你，在可以比较的组合里，哪一组更常选到一起。',
  ]),
  tied: copy([
    "The named partners are tied for your highest agreement rate. Neko has several connections to revisit here; each pairing has reached the same share of matching choices.",
    "Return with these partners separately, keeping the same symbols and process. Choose independently and talk after the reveal, so each pairing keeps its own clear record.",
    "Give each connection another few visits if you'd like. We'll see how the pairings develop without having to settle the tie right away. There's room for more than one familiar partner.",
  ], [
    '上方几位搭档目前并列最有默契，相同选择的比例一样高。Neko这次要多夹几个书签，每条连线都值得再回访看看。',
    '下次可以分别和这些搭档再玩，保留同样的符号与流程。各自独立选择，等揭晓后再聊，每种组合都留下自己的记录。',
    '想继续的话，就给每条连线再添几场，不急着立刻分出第一名。Neko更想看看，和不同搭档一起玩，会怎样慢慢展开。',
  ]),
  only: copy([
    "The named partner has your highest agreement rate so far. This is also the only pairing with enough comparable rounds. Neko would revisit it and add another session.",
    "Keep the symbols familiar and choose independently again. Wait for the reveal, then talk about your choices. That gives this connection another complete visit to compare.",
    "You can invite other partners when you'd like, too. More shared records will let the map compare different pairings while keeping this familiar connection in view.",
  ], [
    '上方这位搭档目前与你最有默契，也是唯一积累了足够同组记录的组合。Neko先记住这条线，下次可以接着玩。',
    '保留熟悉的符号，再各自独立做出选择。等揭晓之后再聊想法，让这条连线多留一场完整记录，也方便前后比较。',
    '想认识别的组合，也可以邀请新搭档加入。共同记录多起来，关系图就能比较不同搭档，这条熟悉的连线也会留在里面。',
  ]),
  single: copy([
    "The named partner has your highest agreement rate among comparable pairings. Neko would put a bookmark on this connection and invite you to return with them.",
    "Use the same symbols and choose independently for another session. Talk after the reveal and keep the complete record, so we can follow how this pairing changes.",
    "Revisit the other pairings when you feel like it, too. Each connection can have its own pace; the map will keep them together so you can look back across those visits.",
  ], [
    '在目前可以比较的组合里，上方这位搭档与你最有默契。Neko替这条连线夹个书签，下一次可以约好再回来玩。',
    '用同样的符号，各自独立完成选择，揭晓之后再聊想法。把整场都留下，我们就能继续看看，这种组合会怎样变化。',
    '也可以再约其他搭档，每条连线都能有自己的节奏。关系图会把这些共同记录留在一起，方便以后回头读读各次相遇。',
  ]),
}

const synthesis = {
  mixed: copy([
    "Your directions are changing at different paces: some are rising and some are lower. Neko would read those lines separately, with each direction's own visits beside it.",
    "Keep the settings familiar in each game when you return. That lets us follow both kinds of change without combining them into one score or losing the details.",
    "You can pick the line you're most curious about for the next session. Keep adding elsewhere when you feel like it; the next report will have more to compare in each direction.",
  ], [
    '你的几个方向出现了不同步的变化，有的正在上升，有的近期回落。Neko会把它们分别读，让每条线保留自己的节奏。',
    '下次在每种玩法里保留熟悉设置，我们就能接着看这些变化。各个方向分开比较，细节会更清楚，也不用挤成一个总分。',
    '下一场先挑最好奇的那条线继续玩，其他方向有空再补。等你带着新记录回来，每个方向都能多一点前后可读的内容。',
  ]),
  rising: copy([
    "Several directions are rising recently. Neko has more than one upward stretch to mark on this report. Keep these sessions together so we can follow each line on the next visit.",
    "Repeat the familiar settings if you'd like to see how the change develops. There's no need for every new session to set a higher result; keep all of them in the record.",
    "The next report can show whether these lines continue upward or turn. Choose a game you want to revisit, play the whole session, and bring the result back when you're ready.",
  ], [
    '这次有几个方向都在近期往上走，Neko要给不止一条线夹上书签啦。先把这些记录留好，下次可以分别看它们的变化。',
    '想看看接下来怎样，就保留熟悉的设置再试。每一场都有自己的结果，不用次次更高，完整留下，前后才方便一起读。',
    '下一份报告会让我们看见，这些线继续上升还是开始转弯。先选最想回访的玩法，完整玩好一场，再带着结果回来就好。',
  ]),
  stable: copy([
    "Several directions have stayed fairly steady recently. Neko can keep this stretch as a familiar reference for later visits, even if the curves aren't making a dramatic turn.",
    "You can repeat the current approach, or choose one direction and change one thing. Keep the rest familiar so you'll know which visits belong together when you compare them.",
    "Let the record follow the games you want to play. Future changes will have these earlier sessions beside them, and we'll be able to see where a different pace began.",
  ], [
    '你的几个方向近期都比较平稳，前后的线没有明显转折。Neko会留好这一段熟悉的参照，以后有变化时可以一起比较。',
    '继续照原来的方式玩也行，选一个方向调整一件小事也行。其他设置先保持熟悉，回头就知道哪些场次可以放在一起看。',
    '记录跟着你想玩的节奏走就好，不用为了图形好看制造起伏。以后有了新变化，我们就能看看，它是从哪里换了步调。',
  ]),
  single: copy([
    "One direction has a clear recent change while the others are steady or still need more visits. Neko would follow that line first and keep the other pages open for later.",
    "Return with familiar settings to the direction that changed. You can add sessions elsewhere at your own pace, so the next comparison has a little more context.",
    "Each completed visit gives us something specific to read. Pick the game you're curious about, finish the session, and we'll put its new result beside the earlier ones.",
  ], [
    '这次有一个方向出现了比较明显的变化，其他线平稳一些，或还在等记录。Neko先沿着这条线看，其他页也好好留着。',
    '下一场在这个方向保留熟悉的设置，接着看看变化怎样延续。其他玩法按自己的节奏补上，下次比较时就有更多前后文。',
    '每次完整做完，我们都多一份具体的记录可读。先选你好奇的项目玩好一场，再把新结果放在旧记录旁边，一起看看喵。',
  ]),
  pending: copy([
    "Your profile has its first outlines, while changes over time still need more visits. Neko would leave the open spaces ready for later and start with a game you want to revisit.",
    "Try a familiar session again or return to the questionnaire. Keep each complete record, including quieter visits, so we can read how the sequence develops.",
    "You don't need to fill every direction at once. A new visit will give us a little more to discuss, and you can decide what to play next after seeing how it went.",
  ], [
    '你的画像已经有了一些轮廓，连续变化还在等更多记录。Neko先留好这些空白，下次从最想再玩的方向开始就行。',
    '可以用熟悉设置再试一场，或者回到问卷看看最近的生活体验。每次完整记录都留着，安静的几场也能接进时间线里。',
    '不用一下填满所有方向，新的一场会给我们多一点话题。等看过这次玩得怎样，你再慢慢决定下一个想去的地方就好。',
  ]),
}

const notes = {
  welcome: copy(["Hi, I'm Neko. Pick a game and I'll keep you company through hidden information, future choices, paired agreement and everyday experience. We can take them one at a time."], ['你好呀，我是Neko。隐藏信息、未来选择、双人默契和日常体验，四个方向都可以一起玩，先挑你最好奇的那个喵。']),
  report_intro: copy(["Neko has put your completed visits together. We'll read the games you've returned to, the lines that changed and the partners who chose with you. Start with whichever page catches your eye."], ['Neko把你完成的记录放在一起啦，我们会看看常玩的方向、最近的变化和搭档默契。先从你最想翻开的那一页开始。']),
  recent_pending: copy(["The timeline needs a few more visits before we can compare earlier and later periods. Keep familiar settings for another session, and Neko will add it to the record."], ['时间线还需要多几次回访，才能比较前后两段。下一场保留熟悉的设置，完整做完，Neko会把新记录接进来等你看。']),
  radar_guide: copy(["The radar puts four directions on one page. Read each one separately; an open direction can wait until you try it. Neko will add its result when a complete record arrives."], ['雷达图把四个方向放在一页，分别看看就好。还没开启的地方先留白，等你完成对应记录，Neko再把新的结果添上去。']),
  radar_note: copy(["The games show their matching rates here, while DSES shows reported experience on the same display range. Read each direction's notes to see how its point was drawn."], ['实验方向展示命中或一致的比例，问卷展示你报告的体验，换到同一显示范围。看看各页说明，就知道每个点怎样画出来。']),
  network_intro: copy(["Each line joins you to someone you've played with. Neko keeps each pairing's shared sessions together; a thicker line means that pairing has more valid rounds in its record."], ['每条线连着一位和你一起玩过的搭档，Neko会把共同记录放在一起。线条越粗，表示你们已经留下更多共同有效回合。']),
  network_empty: copy(["The partner map is still waiting for its first shared visit. Invite someone to choose independently with you, then come back after the reveal and Neko will draw the connection."], ['搭档地图还在等第一次共同探索，约个人一起独立选择，再等揭晓吧。完成之后回来，Neko就能给你们添上第一条连线。']),
  network_caption: copy(["This map shows partners from your own completed sessions. Signed-in partners can keep a connection across visits; guest pairings stay separate so different people aren't merged."], ['这张图只收录与你一起完成过的搭档。登录账号的共同记录可以接起来，游客按房间分别留线，免得把不同的人混到一起。']),
  network_empty_caption: copy(["Your first paired session will give this map a place to begin. Use familiar symbols, let each person choose on their own, and wait for the reveal before discussing the answers."], ['第一场双人测试会给地图一个起点，用熟悉的符号，各自选好再等揭晓。等结束以后再聊答案，Neko会帮你们留好记录。']),
  trend_other: copy(["These sessions use a different group of settings, so Neko keeps their line on a separate chart. Read them together here and return with the same setup if you'd like to compare later."], ['这一组使用了不同设置，Neko给它单独留一条线，不混进其他组里。以后想比较，就用同样设置回来，再添几场完整记录。']),
  trend_empty: copy(["The timeline is waiting for a completed visit. Try a game or fill in the questionnaire, then return here. Neko will place that first record on the chart as the starting point."], ['时间线还在等一份完成的记录，先玩一场或填好问卷，再回来看看。Neko会把第一份放上图，给后面的变化留个起点。']),
  method_profile: copy([
    "Neko uses 20 valid rounds as the point for a fuller experimental description. The six profiles describe where you've spent your visits across games and questionnaires.",
    "Solo games compare their match rate with a 20% reference. More than five percentage points above or below it gets a different description; the middle range is described as steady.",
  ], [
    '实验达到20个有效回合后，Neko才给出更具体的描述。六种画像按你怎样分配实验与问卷记录来分类，看看探索重心。',
    '单人玩法以20%为参考，超过它上下各5个百分点，就换用对应描述。中间范围写作平稳探索，方便你读不同阶段的记录。',
  ]),
  method_trend: copy([
    "A trend needs at least three records with the same protocol and symbols. Each comparison window uses min(3, floor(n/2)) entries from the start and end, without overlap.",
    "Experimental windows each need ten rounds. Neko weights their match rates by round count. A difference above five percentage points is up, below minus five is down; the rest is steady.",
  ], [
    '趋势至少要3次同流程、同符号记录，前后各取min(3,floor(n/2))份。两段不重叠，Neko再比较它们。',
    '实验前后每段都要10回合，按回合数加权计算比例。相差超过正负5个百分点写作上升或回落，其余写作平稳。',
  ]),
  method_partner: copy(["Partner ranking uses signed-in partners with at least ten rounds in the current comparison group. Neko compares agreement rates within that group and keeps tied leaders together."], ['搭档排序只看登录伙伴，同组至少10回合才能参与。Neko比较相同设置下的一致率，遇到并列就一起列出，不急着分第一。']),
  method_dses: copy([
    "DSES descriptions use complete questionnaires. A mean of at least four is frequent, 2.5 to below four is occasional, and below 2.5 is quieter reported experience.",
    "Neko draws the DSES mean as (mean-1)/5*100 on the radar. Earlier and later questionnaires each have equal weight; a display change beyond five points sets the trend direction.",
  ], [
    'DSES只用完整问卷，均值达到4写作体验频繁，达到2.5但低于4写作间歇出现，低于2.5则写作安静阶段。',
    '雷达显示值按(均值-1)/5*100换算。前后问卷等权平均，显示值差超过正负5点才写上升或回落，其他写平稳。',
  ]),
  reading_note: copy([
    "Neko reads these records as an exploration report. The descriptions don't certify supernatural ability, and the Chinese DSES translation hasn't been validated as a measurement scale.",
  ], ['Neko陪你读的是探索记录，报告不能认证超自然能力。中文DSES是网页翻译，尚未经量表效度验证，请带着好奇轻松阅读。']),
  dimension_missing: copy([
    "This direction is still open for a first visit. Pick it when you feel curious and follow the page instructions. Neko will add the chart and commentary after you complete it.",
    "The first record gives later visits a place to begin. You can keep the settings familiar when you return, then read the new session beside your first one.",
  ], [
    '这一方向还留着空白，想试的时候就把它当作新入口吧。按页面流程完成一次，Neko就能为你添上对应的图形和解读。',
    '第一份记录会给以后一个起点，下次可以用熟悉设置再回来。等新的一场做完，我们把前后放在一起，慢慢看看变化。',
  ]),
  dimension_limited: copy([
    "You've left the first few observations in this direction. Neko has a starting point now; a few more complete sessions with familiar settings will give us more to read.",
    "Notice how you decide, including quick choices and longer pauses. Keep the whole session, then return when you'd like to try again. Later records will add detail to this page.",
  ], [
    '这个方向已经有了第一批小片段，Neko收到你的起点啦。保留熟悉的设置，再完整试几场，我们就有更多内容能一起读。',
    '也可以留意决定很快和稍作犹豫的回合，把整场都留下。想再玩的时候回来，新记录会给这一页慢慢添上更多细节。',
  ]),
  trend_insufficient: copy([
    "This timeline needs a few more visits before Neko can compare its earlier and later parts. Keep familiar settings and let the whole session become the next entry.",
    "You can notice the pace of each visit without looking for a rise or fall yet. Connected records will give us a clearer view when you return with another session.",
  ], [
    '这一条时间线还需要多几次回访，Neko才能比较前后两段。先保留熟悉的设置，把整场完整做完，接着添下一份记录。',
    '现在可以留意每次的节奏，不急着寻找上升或回落。等记录慢慢接起来，再回来看看，就会有更清楚的前后变化可读。',
  ]),
  guidance_explore: copy(["Give another direction a complete visit when you're curious. Pick the game that sounds fun, follow its process, and decide afterward whether you'd like to return. Neko can wait for the rest."], ['给还没展开的方向留一次尝试吧，先挑最感兴趣的项目，完整走完再决定要不要回访。其他玩法慢慢补，Neko陪你等。']),
  guidance_dses: copy(["Give everyday experience a first page, too. Complete DSES with the recent period in mind. When you return later, Neko can place the next questionnaire beside this starting point."], ['也给生活体验留一页记录吧，完整填写DSES，照最近一段时间的整体感受回答。以后再回来，Neko就能把前后接起来。']),
  guidance_partner: copy(["Arrange another visit with a partner you'd like to play with. Keep familiar symbols, choose independently and talk after the reveal. You can swap roles for a second view of the pairing."], ['再约一位想继续玩的搭档，用熟悉符号，各自独立选择，揭晓之后才聊想法。也可以交换角色，让共同记录再多一个视角。']),
  guidance_rhythm: copy([
    "Decide on settings and round count before the next game, then finish it and review afterward. Neko will keep the whole visit, including the results you were less pleased with.",
    "If you'd like to try a new approach, adjust one thing at a time. Keeping other settings familiar will make the earlier and later sessions easier to read together.",
  ], [
    '下一场先定好设置和回合数，完整做完再统一回看。没那么满意的一场也留下，Neko会把每次尝试都接进记录里面。',
    '想换一种做法时，一次调整一件小事就好，其他设置先保持熟悉。以后翻回报告，前后的几场就会更容易放在一起读。',
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
