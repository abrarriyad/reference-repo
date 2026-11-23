# Writing the drama: how to write an episode

One task writes one episode. You are given the seed skeleton (target seconds, hook, suspense, claimed beats, candidate scenes and people), the outline's synopsis for this episode, the scene cards and character information, and the previous episode's closing suspense. Output: fill in this episode's `scenes` from empty to full.

## Hard rules

1. **The duration budget comes before everything.** Target seconds is the wall: dialogue is converted at 4.5 characters/second and action at 2.5 seconds/beat; after writing, run validate to see the numbers. A three-minute episode is about 45–55 beats. **If you wrote too much, cut action first; if too little, add conflict, not pleasantries.**
2. **A single line of dialogue is ≤ 35 characters and can be said in one breath.** Split long lines into two, and an action beat or the other person's reaction can go between them.
3. **Each person sounds like themselves.** The boatman does not speak literary Chinese, and the young lady does not speak street talk. A character's temperament, status and way of speaking are in the outline's cast table (more complete with a cast.json) — read it before writing, and write so that with the names covered you can still tell who is speaking.
4. **An action beat is one thing per beat, in narrative voice, and the action must be "common".** "胡二爷's hand stops mid-air, the smile frozen on his face" is one beat; "the atmosphere is awkward" is not an image and cannot be written. **No quoted dialogue inside an action.**
   **Common actions are the lifeline of AI generation** — this drama is ultimately performed by a video model, which can only perform actions it has seen tens of millions of times:

   | Style | Example | Generation result |
   | --- | --- | --- |
   | ✗ Precise physical interaction | The load strikes the gunwale, the bronze bell rings out in fragments. 老周 thrusts out a pole to block it, and the load drops steadily into the cabin | The pole, the load and the gunwale — three-object interaction, certain to collapse |
   | ✓ Common action | 胡二爷 carries the load onto the boat, and 老周 lends a hand to unload it into the cabin | Carry a load, lend a hand, put it down — all common actions |

   The test: is this action common in everyday video? **Boarding a boat, sitting down, handing something over, nodding, turning around, hugging tight, standing up** — write freely; **using a tool to block something, micro-expressions (eyelashes trembling), displacements measured in inches (retreating half an inch), figurative images (like a cocoon gripped by mist)** — rewrite or delete. Dramatic information is delivered by the **combination and timing** of common actions, not by the delicacy of the action itself.
5. **At least one action beat per scene.** If there is not one on-screen action between three lines of dialogue, ask yourself what the audience is watching in this scene.
6. **The hook is not a label, it is the first beat, and it must be given in motion.** Beat 1 of every episode is a cold open: the concrete form of the hook must carry the subject's movement — **✗ a flash of a still-life close-up (an old suitcase held to the chest, knuckles gripped white) ✓ running through the fog hugging an old suitcase**. Running, chasing, breaking free, slamming a hand down — all fine; static detail close-ups (white-gripped knuckles, the outline of a pocket) are saved for the second landing point to pay off (boarding, opening the suitcase). `hookBeat` claims it — the gate checks position, and it must fall within the first 3 beats of the episode; whether there is motion is writing discipline, which the gate cannot check. The previous episode's closing suspense must be picked up in the opening — picking it up does not mean resolving it at once.
7. **The last beat of the ending must be suspense.** An unfinished sentence, an unexplained action, a sound of unknown origin. The `cliff` field gives the effect description, which in the drama lands as one concrete beat.
8. **A claimed beat must have a scene carrying it.** For each big reveal in `beatsClaimed`, this episode must have a continuous run of beats paying it off — the reveal is performed, not just stated in the synopsis.

## Revision discipline (errors most often slip in from single-point edits)

- **Change one beat, re-read three.** After any beat is changed, read the beat before and the beat after together with it again, checking exactly three things: **character positions** (if the last beat was on the shore road, the next beat cannot already be on the pier), **what is in whose hands**, and **who is present**. While writing, the spatial state is in your head; during edits it is not — a continuous re-read is the only way to recover the state.
- **Change the image, change the soundscape too.** Once a script action changes, the downstream storyboard's description, soundscape and storyboard image all have to move together (a lesson from the storyboard skill, to be kept in mind from the script layer at the source).

## Feel rules (no gate, but they decide whether the drama is good)

- **Short dialogue, dense action.** Short-drama dialogue rhythm is twice as fast as TV drama — within two or three lines an action or reaction must cut in, and more than four consecutive lines of dialogue feels stuffy.
- **Write subtext into delivery.** Performance-layer information like "offers a seat in words, body does not move" goes in `delivery`; do not write the subtext as dialogue that gives it away.
- **Use VO sparingly.** An inner voice is emphasis, not a crutch — two or three per episode at most; it is worth the most at moments of dislocation where "the surface is calm and inside is a storm".
- **Split the crowd per the outline's crowdPlan.** The outline says how to break down three or more people in frame, so stage by that plan when writing the drama — who is speaking in the foreground and who is reacting in the background, written out clearly.
- **Scene changes are free, attention is not.** AI scene changes cost nothing, but each time the scene changes the audience has to re-establish spatial sense. Changing scenes four times in two minutes is worse than tightening the drama within one scene.

## Common ailments

| Ailment | Symptom | Cure |
| --- | --- | --- |
| Radio play | A whole scene with only dialogue | Insert one on-screen action beat between every two or three lines |
| Literary disease | Actions written as fine prose: thrusting a pole to block, eyelashes trembling, retreating half an inch | Replace with common actions; see the test table in hard rule 4 |
| Dead opening frame | Beat 1 is a still-life close-up | Give the same concrete form in motion (running through the fog hugging the suitcase), moving the still frame to its second appearance |
| Spatial jump | The last beat running on the shore road, the next only reveals the pier — or the reverse | Change one beat, re-read three; character position is continuous state, and a jump needs a beat of walking over |
| Padding | Pleasantries, offering tea and asking the way take up half an episode | Delete. Every beat must either advance the plot or flip a relationship |
| Speech habit | One person speaking four lines in a row | Hand some to the opponent, or break it with an action |
| Omniscience | Dialogue says all the information | Hide the information in actions and delivery; let the dialogue say only three tenths |
| Headless drama | A flat ending | Change the last beat to suspense, even if it is only a steamer whistle |
