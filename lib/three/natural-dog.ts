import { Group } from "three";
import { organicKit } from "./organic-model";
import { WORLD_STYLE } from "./palette";

/** Retriever-inspired anatomy: chest, haunches, muzzle, floppy ears and hocks. */
export function buildNaturalDog(detail: "hero" | "resident" = "hero") {
  const body = new Group();
  const kit = organicKit(detail);
  const coat = "#ba8c59", cream = "#dfc49a", ears = "#926b46";
  kit.loft(body,coat,[[-.35,.008,.008],[-.30,.08,.08],[-.23,.135,.12],[-.09,.11,.105],[.04,.125,.115],[.14,.16,.13],[.23,.10,.09],[.27,.012,.012]],0,.315,0);
  const neck=kit.oval(body,coat,.20,.435,0,.10,.16,.10,false); neck.rotation.z=-.35;
  kit.oval(body,coat,.315,.565,0,.125,.105,.092,false);
  kit.loft(body,cream,[[.32,.048,.067],[.38,.050,.061],[.46,.037,.046],[.515,.027,.039],[.54,.005,.01]],0,.527,0);
  kit.oval(body,"#3c3832",.522,.547,0,.035,.028,.047,false);
  kit.oval(body,cream,.423,.499,0,.091,.019,.054);
  for(const side of [-1,1]) {
    const ear=kit.oval(body,ears,.28,.511,side*.098,.071,.12,.027); ear.rotation.z=-.2;
    kit.oval(body,"#332c25",.373,.604,side*.077,.019,.016,.011,false);
    kit.oval(body,"#efe9d5",.379,.61,side*.084,.004,.004,.003,false);
  }
  // A fitted collar around the sloping neck.
  kit.curve(body,WORLD_STYLE.teal,[[.19,.465,-.098],[.27,.453,-.075],[.292,.43,0],[.27,.453,.075],[.19,.465,.098]],.014);
  kit.oval(body,WORLD_STYLE.paper,.285,.405,0,.011,.027,.021,false);
  const legs: Group[]=[], knees: Group[]=[];
  for(const [x,z] of [[.15,-.087],[.15,.087],[-.23,-.087],[-.23,.087]]) {
    const hip=new Group(); hip.position.set(x,.285,z);body.add(hip);
    const hind=x<0;
    const thigh=kit.oval(hip,coat,hind?.022:0,-.075,0,hind?.063:.035,.108,.039);thigh.rotation.z=hind?.3:0;
    const knee=new Group();knee.position.set(hind?.04:0,-.15,0);hip.add(knee);
    kit.oval(knee,cream,0,-.058,0,.023,.079,.024);
    kit.oval(knee,cream,.025,-.112,0,.05,.025,.034);
    legs.push(hip);knees.push(knee);
  }
  const tail=new Group();tail.position.set(-.28,.37,0);body.add(tail);
  kit.curve(tail,coat,[[0,0,0],[-.12,.05,0],[-.22,.12,0],[-.29,.17,0]],.032);
  kit.oval(tail,cream,-.285,.168,0,.036,.031,.031);
  return { body,legs,knees,tail,dispose:kit.dispose };
}
