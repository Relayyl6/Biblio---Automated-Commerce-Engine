import { logger } from "@ace/shared/logger.js";
import {sql} from '@ace/shared/clients'; 
sql`select * from escrow_accounts`.then(logger.log).then(()=>process.exit(0))
