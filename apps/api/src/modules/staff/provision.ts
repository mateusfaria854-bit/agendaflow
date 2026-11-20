import {database} from '../../db/client.js';
import {hashPassword,validPassword} from '../auth/password.js';

type Input={professionalId:string;name:string;email:string;password:string};

export class ProvisioningError extends Error {
  constructor(public readonly kind:'INVALID'|'CONFLICT'|'NOT_FOUND',message:string){super(message)}
}

/** Cria uma conta PROFISSIONAL exclusivamente pelo provisionamento administrativo local. */
export async function provisionStaffAccount(input:Input):Promise<{id:string;email:string;professionalId:string}>{
  const professionalId=input.professionalId?.trim();
  const name=input.name?.trim();
  const email=input.email?.trim().toLowerCase();
  if(!professionalId||!/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(professionalId)||
     !name||name.length<2||name.length>140||
     !email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
     !validPassword(input.password)){
    throw new ProvisioningError('INVALID','ID, nome, e-mail ou senha inválidos (mínimo 12 caracteres).');
  }
  const passwordHash=await hashPassword(input.password);
  const conn=await database().connect();
  try{
    await conn.query('BEGIN');
    // Trava evita que dois provisionamentos associem contas diferentes à mesma agenda.
    const professional=await conn.query<{id:string;user_id:string|null}>(
      'SELECT id,user_id FROM professionals WHERE id=$1 FOR UPDATE',[professionalId],
    );
    if(!professional.rowCount)throw new ProvisioningError('NOT_FOUND','Profissional não encontrado.');
    if(professional.rows[0].user_id)throw new ProvisioningError('CONFLICT','Este profissional já possui uma conta vinculada.');
    const created=await conn.query<{id:string;email:string}>(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'PROFISSIONAL') RETURNING id,email",
      [name,email,passwordHash],
    );
    await conn.query('UPDATE professionals SET user_id=$1 WHERE id=$2',
      [created.rows[0].id,professionalId]);
    await conn.query(
      "INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id) VALUES(NULL,'PROFESSIONAL_ACCOUNT_PROVISIONED','professional',$1)",
      [professionalId],
    );
    await conn.query('COMMIT');
    return {...created.rows[0],professionalId};
  }catch(error){
    await conn.query('ROLLBACK');
    if((error as {code?:string}).code==='23505'){
      throw new ProvisioningError('CONFLICT','E-mail já cadastrado; nenhuma conta existente será convertida.');
    }
    throw error;
  }finally{conn.release()}
}
