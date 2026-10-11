import { logger } from "@ace/shared/logger.js";
import {sql} from '@ace/shared/clients'; 
sql`select id, state from orders where merchant_id = '11111111-1111-1111-1111-111111111111'`.then(logger.log).then(()=>process.exit(0))
