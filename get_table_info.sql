-- Función para obtener información de la estructura de una tabla
CREATE OR REPLACE FUNCTION get_table_info(table_name text)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'table_name', table_name,
        'columns', (
            SELECT json_agg(
                json_build_object(
                    'column_name', c.column_name,
                    'data_type', c.data_type,
                    'is_nullable', c.is_nullable,
                    'column_default', c.column_default,
                    'constraints', (
                        SELECT json_agg(
                            json_build_object(
                                'constraint_name', tc.constraint_name,
                                'constraint_type', tc.constraint_type
                            )
                        )
                        FROM information_schema.table_constraints tc
                        WHERE tc.table_name = c.table_name 
                        AND tc.constraint_type = 'CHECK'
                        AND tc.constraint_name LIKE '%' || c.column_name || '%'
                    )
                )
            )
            FROM information_schema.columns c
            WHERE c.table_name = table_name
        ),
        'check_constraints', (
            SELECT json_agg(
                json_build_object(
                    'constraint_name', conname,
                    'constraint_definition', pg_get_constraintdef(oid)
                )
            )
            FROM pg_constraint
            WHERE conrelid = table_name::regclass
            AND contype = 'c'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql; 