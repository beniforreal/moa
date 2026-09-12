import {randomBytes,createCipheriv,createDecipheriv,createHmac,timingSafeEqual} from 'node:crypto';
export function encrypt(value,key=process.env.CREDENTIALS_ENCRYPTION_KEY){
 if(!key||Buffer.from(key,'base64').length!==32)throw new Error('암호화 키 설정이 필요합니다.');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);
 const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),body].map(x=>x.toString('base64url')).join('.');
}
export function decrypt(value,key=process.env.CREDENTIALS_ENCRYPTION_KEY){const [iv,tag,body]=value.split('.').map(x=>Buffer.from(x,'base64url'));const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(body),cipher.final()]).toString('utf8')}
export function verifySignature(body,signature,secret){if(!secret||!/^sha256=[a-f0-9]{64}$/.test(signature||''))return false;const expected=createHmac('sha256',secret).update(body).digest();return timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex'))}
export function canApprove(status){return ['new','draft','approved'].includes(status)}
export function canSend(item){return item.status==='approved'&&!!item.approved_text&&item.approved_text===item.draft}
