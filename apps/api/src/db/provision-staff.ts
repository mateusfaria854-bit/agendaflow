import 'dotenv/config';
import {closeDatabase} from './client.js';
import {provisionStaffAccount,ProvisioningError} from '../modules/staff/provision.js';

try{
  const result=await provisionStaffAccount({
    professionalId:process.env.PROFESSIONAL_ID??'',
    name:process.env.STAFF_NAME??'',
    email:process.env.STAFF_EMAIL??'',
    password:process.env.STAFF_PASSWORD??'',
  });
  console.log('Conta de profissional vinculada:',result.email,'→',result.professionalId);
}catch(error){
  console.error(error instanceof ProvisioningError?error.message:'Não foi possível provisionar o profissional.');
  process.exitCode=1;
}finally{
  await closeDatabase();
}
