import { fitPhysicalDimension, HUMAN_HEIGHT_M } from "./world-scale";
// A smooth, articulated traveler. Local +X faces forward; feet sit at Y=0.
import { Group } from "three";
import { organicKit } from "./organic-model";
import { WORLD_STYLE } from "./palette";

export type RunnerPose = "idle" | "run" | "jump" | "chop";


/** Outfit color scheme — picked on the title screen. */
export interface Outfit {
  jacket: string;
  crest: string;
}

export const OUTFITS: Array<Outfit & { label: string }> = [
  { label: "Courier", jacket: "#2e5d66", crest: "#d2693e" },
  { label: "Forest", jacket: "#3e7d58", crest: "#efe7cf" },
  { label: "Rose", jacket: "#c4798c", crest: "#3a4d48" },
  { label: "Ink", jacket: "#3a4d48", crest: "#d9b25e" },
];

export interface Runner {
  group: Group;
  /** Drive the animation. `phase` advances with distance for run cycle. */
  setPose(pose: RunnerPose, phase: number): void;
  dispose(): void;
}

export function buildRunner(outfit: Outfit = OUTFITS[0], detail: "hero" | "resident" = "hero"): Runner {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const kit = organicKit(detail);
  const skin = "#e5b990";
  const pants = "#455b60";
  const hair = "#51463d";
  // A continuous jacket surface: hips, waist, chest and sloping shoulders.
  kit.profile(body, outfit.jacket, [[0,.43],[.115,.43],[.14,.47],[.13,.54],[.155,.64],[.15,.69],[.105,.73],[.055,.74],[0,.74]],0,0,0,.66);
  kit.oval(body, pants,0,.43,0,.09,.095,.125);
  kit.oval(body, skin,0,.755,0,.045,.06,.047);
  const head=new Group();body.add(head);
  kit.oval(head, skin,.015,.89,0,.12,.145,.105);
  kit.oval(head, skin,.124,.875,0,.035,.031,.024,false); // nose
  for (const side of [-1,1]) {
    kit.oval(head, skin,0,.885,side*.105,.027,.044,.021,false);
    kit.oval(head,"#393e39",.116,.919,side*.040,.012,.012,.009,false);
    kit.curve(head,hair,[[.107,.94,side*.028],[.113,.944,side*.043],[.10,.94,side*.055]],.004);
  }
  kit.curve(head,"#a56d59",[[.123,.842,-.025],[.13,.839,0],[.123,.842,.025]],.003);
  // Close-fitting hair and soft travel cap; no rectangular head or crest.
  kit.oval(head,hair,-.026,.948,0,.105,.084,.109);
  kit.oval(head,outfit.jacket,-.016,.99,0,.118,.069,.12);
  kit.oval(head,outfit.jacket,.105,.976,0,.092,.012,.114);
  kit.oval(head,outfit.crest,.114,1.007,0,.013,.020,.027,false);
  // Reduce the head-to-body ratio while retaining the existing eye/hat assembly.
  for(const part of head.children)part.position.y-=.89;
  head.scale.setScalar(.82);head.position.y=.89;
  // Curved pack and straps follow the torso.
  kit.oval(body,WORLD_STYLE.bark,-.105,.595,0,.060,.13,.12);
  kit.oval(body,outfit.jacket,-.15,.665,0,.028,.055,.115);
  for (const z of [-.083,.083]) kit.curve(body,WORLD_STYLE.paper,[[-.10,.66,z],[0,.718,z],[.095,.64,z],[.085,.49,z]],.013);
  kit.curve(body,WORLD_STYLE.paper,[[.094,.48,0],[.099,.57,0],[.098,.68,0]],.004);
  const arms: Group[] = [], elbows: Group[] = [], legs: Group[] = [], knees: Group[] = [];
  for (const side of [-1,1]) {
    const arm = new Group(); arm.position.set(0,.685,side*.15); body.add(arm);
    kit.oval(arm,outfit.jacket,0,-.073,0,.048,.099,.046);
    const elbow = new Group(); elbow.position.y=-.15; arm.add(elbow);
    kit.oval(elbow,outfit.jacket,0,-.045,0,.037,.075,.037);
    kit.oval(elbow,skin,0,-.128,0,.031,.045,.027);
    kit.oval(elbow,skin,.023,-.122,side*.014,.013,.026,.014,false);
    elbow.rotation.z=-.3; arms.push(arm); elbows.push(elbow);
    const hip = new Group(); hip.position.set(0,.445,side*.077); body.add(hip);
    kit.oval(hip,pants,0,-.105,0,.058,.135,.055);
    const knee = new Group(); knee.position.y=-.217; hip.add(knee);
    kit.oval(knee,pants,0,-.09,0,.042,.118,.043);
    kit.oval(knee,outfit.crest,.036,-.192,0,.084,.036,.049);
    kit.oval(knee,WORLD_STYLE.paper,.037,-.214,0,.085,.014,.05);
    legs.push(hip); knees.push(knee);
  }
  fitPhysicalDimension(root,"y",HUMAN_HEIGHT_M);
  return {
    group: root,
    setPose(pose: RunnerPose, phase: number) {
      body.position.y=0; body.rotation.z=0;
      for(let i=0;i<2;i++) { arms[i].rotation.z=0; elbows[i].rotation.z=-.3; legs[i].rotation.z=0; knees[i].rotation.z=0; }
      if(pose==="run") {
        const stride=Math.sin(phase);
        for(let i=0;i<2;i++) {
          const s=stride*(i===0?1:-1);
          legs[i].rotation.z=s*.65;
          knees[i].rotation.z=Math.max(0,-s)*.95;
          arms[i].rotation.z=-s*.6;
          elbows[i].rotation.z=-.7;
        }
        body.position.y=Math.abs(Math.cos(phase))*.025;
        body.rotation.z=-.08;
      } else if(pose==="jump") {
        legs[0].rotation.z=-.45; legs[1].rotation.z=.35;
        knees[0].rotation.z=.9; knees[1].rotation.z=.6;
        arms.forEach(a=>a.rotation.z=-1.35);
      } else if(pose==="chop") {
        const sw=Math.sin(Math.min(phase,1)*Math.PI);
        arms.forEach(a=>a.rotation.z=-2.3+sw*1.6);
        body.rotation.z=-.18*sw;
        knees.forEach(k=>k.rotation.z=.15*sw);
      } else body.position.y=Math.sin(phase*.15)*.006;
    },
    dispose: kit.dispose,
  };
}
