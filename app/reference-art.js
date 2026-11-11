import {icon as baseIcon} from './icons.js?v=sharp-camera-20261111';
export {art,courseFigure} from './vector-art.js?v=sharp-camera-20261111';

const aliases={capture:'photo',person:'profile',stats:'progress'};
export function icon(name,cls=''){
 return baseIcon(aliases[name]||name,`reference-icon ref-${name} ${cls}`);
}
