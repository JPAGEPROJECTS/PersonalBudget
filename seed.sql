-- Importa los datos de presupuesto.xlsx. Ejecutar UNA sola vez en el SQL Editor (después de schema.sql).
do $$
declare p uuid; d_tc uuid; d_celu uuid;
begin
  insert into deudas(nombre,saldo_inicial,limite,meta,interes_pct) values ('Tarjeta de crédito',884.05,1680,1000,2) returning id into d_tc;
  insert into deudas(nombre,saldo_inicial) values ('Celu',1120) returning id into d_celu;
  insert into periodos(nombre,fecha,salario) values ('15 de Abril','2026-04-15',670.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'PrestYa',80.0,true,null,1),
    (p,'Electricidad',0.0,false,null,2),
    (p,'Celu',70.0,true,null,3),
    (p,'Internet / Teléfono',25.0,true,null,4),
    (p,'Supermercado',0.0,false,null,5),
    (p,'Transporte / Gasolina',60.0,true,null,6),
    (p,'Ocio',60.0,true,null,7),
    (p,'Tarjeta de crédito',159.0,true,null,8),
    (p,'Matricula',41.0,true,null,9),
    (p,'Zapatos',60.0,true,null,10),
    (p,'Pantalón negro',20.0,false,null,11),
    (p,'Kevin',33.0,true,null,12),
    (p,'Mamá',22.0,true,null,13),
    (p,'Juego',35.0,true,null,14),
    (p,'Gym',15.0,true,null,15);
  insert into periodos(nombre,fecha,salario) values ('30 de Abril','2026-04-30',395.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'PrestYa',80.0,true,null,1),
    (p,'Novey',19.59,true,null,2),
    (p,'Celu',0.0,false,null,3),
    (p,'Internet / Teléfono',25.0,true,null,4),
    (p,'Supermercado',0.0,false,null,5),
    (p,'Transporte / Gasolina',60.0,true,null,6),
    (p,'Ocio',60.0,true,null,7),
    (p,'Tarjeta de crédito',109.0,true,null,8),
    (p,'Cesar',21.4,true,null,9);
  insert into periodos(nombre,fecha,salario) values ('15 de Mayo','2026-05-15',505.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'PrestYa',75.0,true,null,1),
    (p,'Tarjeta de crédito',130.0,true,null,2),
    (p,'Celu',70.0,true,null,3),
    (p,'Internet / Teléfono',25.0,true,null,4),
    (p,'Ocio',60.0,true,null,5),
    (p,'Transporte / Gasolina',60.0,true,null,6),
    (p,'Bag',5.0,true,null,7),
    (p,'Samuel',20.0,true,null,8);
  insert into periodos(nombre,fecha,salario) values ('30 de Mayo','2026-05-30',505.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'PrestYa',95.0,true,null,1),
    (p,'Tarjeta de crédito',215.0,true,null,2),
    (p,'Celu',0.0,true,null,3),
    (p,'Internet / Teléfono',25.0,true,null,4),
    (p,'Ocio',80.0,true,null,5),
    (p,'Transporte / Gasolina',60.0,true,null,6),
    (p,'David',5.0,true,null,7);
  insert into periodos(nombre,fecha,salario) values ('15 de Junio','2026-06-15',505.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'PrestYa',70.0,true,null,1),
    (p,'Tarjeta de crédito',10.0,false,null,2),
    (p,'Celu',70.0,true,null,3),
    (p,'Internet / Teléfono',20.0,true,null,4),
    (p,'Ocio',60.0,true,null,5),
    (p,'Transporte / Gasolina',50.0,true,null,6),
    (p,'Dad',30.0,false,null,7);
  insert into periodos(nombre,fecha,salario) values ('30 de Junio','2026-06-30',505.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'PrestYa',70.0,true,null,1),
    (p,'Tarjeta de crédito',90.0,false,null,2),
    (p,'Celu',0.0,true,null,3),
    (p,'Internet / Teléfono',25.0,true,null,4),
    (p,'Ocio',80.0,true,null,5),
    (p,'Transporte / Gasolina',60.0,true,null,6);
  insert into periodos(nombre,fecha,salario) values ('15 de Julio','2026-07-15',505.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'Tarjeta de crédito',125.76,true,null,1),
    (p,'Celu',70.0,true,null,2),
    (p,'Internet / Teléfono',25.0,true,null,3),
    (p,'Ocio',80.0,true,null,4),
    (p,'Transporte / Gasolina',60.0,true,null,5),
    (p,'Help ppl',0.0,false,null,6),
    (p,'PYa',42.0,true,null,7),
    (p,'Bday',60.0,false,null,8);
  insert into periodos(nombre,fecha,salario) values ('30 de Julio','2026-07-30',505.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'Tarjeta de crédito',0.0,false,null,1),
    (p,'Celu',0.0,true,null,2),
    (p,'Internet / Teléfono',25.0,true,null,3),
    (p,'Ocio',80.0,true,null,4),
    (p,'Transporte / Gasolina',60.0,true,null,5);
  insert into periodos(nombre,fecha,salario) values ('15 de Agosto','2026-08-15',775.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'Tarjeta de crédito',115.0,false,null,1),
    (p,'Celu',70.0,true,null,2),
    (p,'Internet / Teléfono',25.0,true,null,3),
    (p,'Ocio',80.0,true,null,4),
    (p,'Transporte / Gasolina',60.0,true,null,5),
    (p,'Aniversario',250.0,true,null,6),
    (p,'susu',100.0,true,null,7),
    (p,'Jimmy',75.0,true,null,8);
  insert into periodos(nombre,fecha,salario) values ('30 de Agosto','2026-08-30',505.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'Tarjeta de crédito',240.0,false,null,1),
    (p,'Celu',0.0,true,null,2),
    (p,'Internet / Teléfono',25.0,true,null,3),
    (p,'Ocio',80.0,true,null,4),
    (p,'Transporte / Gasolina',60.0,true,null,5),
    (p,'susu',100.0,true,null,6);
  insert into periodos(nombre,fecha,salario) values ('15 de Septiembre','2026-09-15',505.0) returning id into p;
  insert into gastos(periodo_id,descripcion,monto,pagado,deuda_id,orden) values
    (p,'Tarjeta de crédito',170.0,false,d_tc,1),
    (p,'Celu',70.0,true,d_celu,2),
    (p,'Internet / Teléfono',25.0,true,null,3),
    (p,'Ocio',80.0,true,null,4),
    (p,'Transporte / Gasolina',60.0,true,null,5),
    (p,'susu',100.0,true,null,6);
end $$;
