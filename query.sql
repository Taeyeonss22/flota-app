SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'pedidos';
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'pedidos'::regclass;
